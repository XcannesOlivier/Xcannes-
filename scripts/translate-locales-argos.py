#!/usr/bin/env python3
import argparse
import json
import os
import re
from pathlib import Path

import argostranslate.package
import argostranslate.translate


GLOSSARY = [
    "XCANNES",
    "XCS",
    "XRP",
    "XRPL",
    "RLUSD",
    "XUMM",
    "Xumm",
    "Xaman",
    "MoonPay",
    "Stripe",
    "Cannes",
    "DEX",
    "WebSocket",
    "WSJ",
]


FRENCH_HEURISTICS = [
    "é",
    "è",
    "ê",
    "à",
    "â",
    "î",
    "ï",
    "ô",
    "ù",
    "ç",
    "’",
    " l’",
    " d’",
    " j’",
    " n’",
    " qu’",
    " vous ",
    " votre ",
    " vos ",
    " nous ",
    " merci",
    " portefeuille",
    " relevé",
    " envoyer",
    " recevoir",
    " accueil",
]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def protect_text(text: str, extra_terms=None):
    protected = text
    mapping = {}
    terms = list(GLOSSARY)
    if extra_terms:
        terms.extend(list(extra_terms))
    for idx, term in enumerate(sorted(set(terms), key=len, reverse=True)):
        token = f"__GLOSSARY_{idx}__"
        if term in protected:
            protected = protected.replace(term, token)
            mapping[token] = term
    return protected, mapping


def unprotect_text(text: str, mapping: dict):
    out = text
    for token, term in mapping.items():
        out = out.replace(token, term)
    return out


def translate(text: str, from_code: str, to_code: str) -> str:
    protected, mapping = protect_text(text)
    translated = argostranslate.translate.translate(protected, from_code, to_code)
    return unprotect_text(translated, mapping)


def should_contextualize(src: str) -> bool:
    s = str(src or "")
    if not s.strip():
        return False
    if len(s) > 24:
        return False
    words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", s)
    if len(words) > 3:
        return False
    # Skip pure acronyms/codes (SUP, XRPL, USD, etc.)
    if re.fullmatch(r"[A-Z0-9]{2,6}", s.strip()):
        return False
    # Skip glossary terms (brands/tickers).
    if s.strip() in GLOSSARY:
        return False
    return True


def translate_with_context(src: str, from_code: str, to_code: str) -> str:
    # Provide a short sentence context. Many MT models won't translate single-word UI
    # labels without context (e.g. "Home", "Reset"). We extract what comes after ":".
    wrapped = f"The button says: {src}"
    protected, mapping = protect_text(wrapped)
    translated = argostranslate.translate.translate(protected, from_code, to_code)
    translated = unprotect_text(translated, mapping)
    parts = re.split(r"[:：]", str(translated), maxsplit=1)
    if len(parts) == 2:
        candidate = parts[1].strip()
        if candidate:
            return candidate
    return translated.strip()


def ensure_packages(pairs: list[tuple[str, str]]):
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    installed = {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}

    needed = [(a, b) for (a, b) in pairs if (a, b) not in installed]
    if not needed:
        return

    for from_code, to_code in needed:
        matches = [p for p in available if p.from_code == from_code and p.to_code == to_code]
        if not matches:
            raise RuntimeError(f"No Argos package available for {from_code}->{to_code}")
        pkg = matches[0]
        download_path = pkg.download()
        argostranslate.package.install_from_path(download_path)


def locale_to_argos_code(locale: str) -> str | None:
    # Normalize region locales to base codes Argos expects.
    if locale.startswith("ar-"):
        return "ar"
    mapping = {
        "no-NO": "nb",  # Norwegian Bokmål
        "sv-SE": "sv",
        "da-DK": "da",
        "fi-FI": "fi",
        "is-IS": "is",
        "pl-PL": "pl",
        "ru-RU": "ru",
        "el-GR": "el",
        "tr-TR": "tr",
        "th-TH": "th",
        "vi-VN": "vi",
        "bn-BD": "bn",
        "ur-PK": "ur",
        "sw-KE": "sw",
        "rm-CH": "rm",
    }
    return mapping.get(locale, locale)


def looks_french(text: str) -> bool:
    s = f" {str(text).lower()} "
    return any(marker in s for marker in FRENCH_HEURISTICS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--locales", default="", help="Comma-separated locales to translate (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--force", action="store_true", help="Translate even if value already differs from en")
    parser.add_argument("--max", type=int, default=0, help="Limit number of keys translated per locale (0 = no limit)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    locales_root = repo_root / "public" / "locales"
    en_path = locales_root / "en" / "common.json"

    en_obj = load_json(en_path)
    base_keys = list(en_obj.keys())

    locale_dirs = sorted([p.name for p in locales_root.iterdir() if p.is_dir()])
    requested = [s.strip() for s in args.locales.split(",") if s.strip()] if args.locales else []
    target_locales = [l for l in (requested or locale_dirs) if l in locale_dirs]

    # Determine what argos pairs we need (en->target, plus fr->en for normalization).
    argos_targets = set()
    for locale in target_locales:
        if locale == "en":
            continue
        code = locale_to_argos_code(locale)
        if code:
            argos_targets.add(code)

    needed_pairs = [("fr", "en")] + [("en", c) for c in sorted(argos_targets) if c != "en"]

    # Some locales are not supported by Argos; we will report them.
    argostranslate.package.update_package_index()
    available = argostranslate.package.get_available_packages()
    available_pairs = {(p.from_code, p.to_code) for p in available}
    supported_targets = {to for (frm, to) in available_pairs if frm == "en"}

    unsupported = sorted([c for c in argos_targets if c not in supported_targets])

    # Install all supported packages we need.
    install_pairs = [p for p in needed_pairs if p in available_pairs]
    ensure_packages(install_pairs)

    # Normalize EN file: translate French-looking strings to English using fr->en (if installed).
    fr_to_en_supported = ("fr", "en") in {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}
    normalized_count = 0
    if fr_to_en_supported:
        for k in base_keys:
            v = en_obj.get(k)
            if isinstance(v, str) and looks_french(v):
                en_obj[k] = translate(v, "fr", "en")
                normalized_count += 1

    if not args.dry_run and normalized_count:
        write_json(en_path, en_obj)

    # Translate locales
    translated_locales = []
    skipped_locales = []

    for locale in target_locales:
        if locale == "en":
            continue
        code = locale_to_argos_code(locale)
        if code in unsupported or ("en", code) not in {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}:
            # Special fallbacks:
            # - wuu: copy zh
            # - rm/is/lb/sw: keep English for now (will be handled manually if needed)
            if locale == "wuu" and (locales_root / "zh" / "common.json").exists():
                if not args.dry_run:
                    zh_obj = load_json(locales_root / "zh" / "common.json")
                    write_json(locales_root / "wuu" / "common.json", zh_obj)
                translated_locales.append({"locale": locale, "mode": "copied", "from": "zh"})
                continue

            skipped_locales.append({"locale": locale, "code": code, "reason": "unsupported_by_argos"})
            continue

        target_path = locales_root / locale / "common.json"
        locale_obj = load_json(target_path)

        plain_cache: dict[str, str] = {}
        context_cache: dict[str, str] = {}
        translated_count = 0

        out_obj = {}
        for k in base_keys:
            src = en_obj.get(k, "")
            current = locale_obj.get(k, src)
            if args.force or current == src:
                if args.max and translated_count >= args.max:
                    out_obj[k] = current
                    continue
                if isinstance(src, str) and src.strip():
                    if should_contextualize(src):
                        if src in context_cache:
                            out_value = context_cache[src]
                        else:
                            contextual = translate_with_context(src, "en", code)
                            if contextual and contextual.strip() and contextual.strip() != src:
                                out_value = contextual.strip()
                            else:
                                out_value = translate(src, "en", code)
                            context_cache[src] = out_value
                    else:
                        if src in plain_cache:
                            out_value = plain_cache[src]
                        else:
                            out_value = translate(src, "en", code)
                            plain_cache[src] = out_value
                    out_obj[k] = out_value
                    translated_count += 1
                else:
                    out_obj[k] = src
            else:
                out_obj[k] = current

        # Preserve any locale-only keys
        for k, v in locale_obj.items():
            if k not in out_obj:
                out_obj[k] = v

        if not args.dry_run:
            write_json(target_path, out_obj)

        translated_locales.append({"locale": locale, "mode": "argos", "to": code})

        # Copy Arabic base to regions (only if they exist)
        if locale == "ar":
            for l in locale_dirs:
                if l.startswith("ar-"):
                    if not args.dry_run:
                        write_json(locales_root / l / "common.json", out_obj)
                    translated_locales.append({"locale": l, "mode": "copied", "from": "ar"})

    print(
        json.dumps(
            {
                "dryRun": args.dry_run,
                "baseKeys": len(base_keys),
                "normalizedEnFromFrenchCount": normalized_count,
                "translatedLocales": translated_locales,
                "skippedLocales": skipped_locales,
                "unsupportedArgosCodes": unsupported,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
