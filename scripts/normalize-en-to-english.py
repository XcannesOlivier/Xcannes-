#!/usr/bin/env python3
import argparse
import json
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


FRENCH_STOPWORDS = {
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "du",
    "de",
    "d",
    "au",
    "aux",
    "ce",
    "cet",
    "cette",
    "ces",
    "en",
    "pour",
    "avec",
    "sur",
    "dans",
    "par",
    "ou",
    "et",
    "est",
    "sont",
    "pas",
    "plus",
    "ici",
    "vous",
    "votre",
    "vos",
    "nous",
    "ne",
    "que",
    "qui",
    "quoi",
    "comment",
    "si",
    "se",
    "sa",
    "son",
    "ses",
    "faire",
    "utiliser",
    "wallet",
    "portefeuille",
    "releve",
    "relevé",
    "demo",
    "démo",
    "acheter",
    "vendre",
    "envoyer",
    "recevoir",
    "connexion",
    "securise",
    "sécurisé",
    "avertissement",
}

FRENCH_HINT_WORDS_STRONG = {
    # Common FR UI terms we saw in the EN JSON (often without accents)
    "ajuster",
    "automatiquement",
    "devises",
    "grille",
    "renommer",
    "fermer",
    "activer",
    "enregistrer",
    "annuler",
    "interne",
    "lignes",
    "paiement",
    "portefeuille",
    "releve",
    "relevé",
    "securise",
    "sécurisé",
    "tout",
    "puis",
    "entre",
}


ENGLISH_STOPWORDS = {
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "for",
    "with",
    "your",
    "you",
    "we",
    "our",
    "on",
    "by",
    "is",
    "are",
    "not",
    "this",
    "that",
    "these",
    "those",
    "use",
    "wallet",
    "demo",
}


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


def translate_fr_to_en(text: str) -> str:
    protected, mapping = protect_text(text)
    translated = argostranslate.translate.translate(protected, "fr", "en")
    return unprotect_text(translated, mapping)


def tokenize_words(text: str):
    return re.findall(r"[A-Za-zÀ-ÿ]+", str(text).lower())


def looks_french(text: str) -> bool:
    s = str(text or "")
    if not s.strip():
        return False

    lowered = f" {s.lower()} "

    # Strong signals
    if re.search(r"[àâçéèêëîïôùûüœ]", lowered):
        return True
    if " l'" in lowered or " d'" in lowered or " qu'" in lowered or " n'" in lowered:
        return True
    if "’" in lowered:
        return True

    words = tokenize_words(s)
    if not words:
        return False

    if any(w in FRENCH_HINT_WORDS_STRONG for w in words):
        return True

    fr = sum(1 for w in words if w in FRENCH_STOPWORDS)
    en = sum(1 for w in words if w in ENGLISH_STOPWORDS)

    # Heuristic threshold: at least 2 French stopwords and more French than English.
    if fr >= 2 and fr > en:
        return True

    # Some short French UI labels
    if fr >= 1 and len(words) <= 6 and fr >= en + 1:
        return True

    return False


def ensure_fr_en_package():
    argostranslate.package.update_package_index()
    installed = {(p.from_code, p.to_code) for p in argostranslate.package.get_installed_packages()}
    if ("fr", "en") in installed:
        return
    available = argostranslate.package.get_available_packages()
    matches = [p for p in available if p.from_code == "fr" and p.to_code == "en"]
    if not matches:
        raise RuntimeError("No Argos package available for fr->en")
    pkg = matches[0]
    download_path = pkg.download()
    argostranslate.package.install_from_path(download_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max", type=int, default=0, help="Limit number of translations (0 = no limit)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    en_path = repo_root / "public" / "locales" / "en" / "common.json"
    en_obj = load_json(en_path)

    ensure_fr_en_package()

    french_keys = []
    for k, v in en_obj.items():
        if isinstance(v, str) and looks_french(v):
            french_keys.append(k)

    translated = 0
    for k in french_keys:
        if args.max and translated >= args.max:
            break
        src = en_obj[k]
        out = translate_fr_to_en(src)
        # Only apply if it actually changed or still looks French (avoid no-op)
        if out and out.strip():
            en_obj[k] = out
        translated += 1

    if not args.dry_run and translated:
        write_json(en_path, en_obj)

    # Re-scan for remaining French after modifications
    remaining = [k for k, v in en_obj.items() if isinstance(v, str) and looks_french(v)]

    print(
        json.dumps(
            {
                "dryRun": args.dry_run,
                "totalKeys": len(en_obj),
                "detectedFrenchKeys": len(french_keys),
                "translated": translated,
                "remainingFrenchKeys": len(remaining),
                "remainingSample": remaining[:50],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
