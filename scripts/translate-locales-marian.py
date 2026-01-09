#!/usr/bin/env python3
import argparse
import json
import os
import re
from pathlib import Path

import torch
from transformers import MarianMTModel, MarianTokenizer


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


LOCALE_TO_MODEL = {
    "is-IS": "Helsinki-NLP/opus-mt-en-is",
    "sw-KE": "Helsinki-NLP/opus-mt-en-sw",
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


def should_contextualize(src: str) -> bool:
    s = str(src or "")
    if not s.strip():
        return False
    if len(s) > 24:
        return False
    words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", s)
    if len(words) > 3:
        return False
    if re.fullmatch(r"[A-Z0-9]{2,6}", s.strip()):
        return False
    if s.strip() in GLOSSARY:
        return False
    return True


class MarianTranslator:
    def __init__(self, model_name: str, device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self.tokenizer = MarianTokenizer.from_pretrained(model_name)
        self.model = MarianMTModel.from_pretrained(model_name)
        self.model.to(device)
        self.model.eval()

    @torch.inference_mode()
    def translate_many(self, texts: list[str], batch_size: int = 16, max_length: int = 512) -> list[str]:
        out: list[str] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            enc = self.tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=max_length)
            enc = {k: v.to(self.device) for k, v in enc.items()}
            gen = self.model.generate(**enc, max_new_tokens=128)
            out.extend(self.tokenizer.batch_decode(gen, skip_special_tokens=True))
        return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--locales", default="", help="Comma-separated locales to translate (default: all supported)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--force", action="store_true", help="Translate even if value already differs from en")
    parser.add_argument("--max", type=int, default=0, help="Limit number of keys translated per locale (0 = no limit)")
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    locales_root = repo_root / "public" / "locales"
    en_path = locales_root / "en" / "common.json"
    en_obj = load_json(en_path)
    base_keys = list(en_obj.keys())

    locale_dirs = sorted([p.name for p in locales_root.iterdir() if p.is_dir()])
    requested = [s.strip() for s in args.locales.split(",") if s.strip()] if args.locales else []
    candidates = requested or list(LOCALE_TO_MODEL.keys())
    target_locales = [l for l in candidates if l in locale_dirs and l in LOCALE_TO_MODEL]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    translated_locales = []

    for locale in target_locales:
        model_name = LOCALE_TO_MODEL[locale]
        translator = MarianTranslator(model_name, device=device)

        target_path = locales_root / locale / "common.json"
        locale_obj = load_json(target_path)

        plain_cache: dict[str, str] = {}
        context_cache: dict[str, str] = {}

        pending: list[tuple[str, str, str, str, dict]] = []
        out_obj: dict = {}
        translated_count = 0

        def flush_pending():
            nonlocal pending, out_obj, translated_count
            if not pending:
                return
            texts = [p[3] for p in pending]
            translated = translator.translate_many(texts, batch_size=args.batch_size)
            for (key, kind, src_original, _src_protected, mapping), mt in zip(pending, translated):
                mt = unprotect_text(mt, mapping).strip()
                if kind == "context":
                    parts = re.split(r"[:：]", str(mt), maxsplit=1)
                    candidate = parts[1].strip() if len(parts) == 2 else mt.strip()
                    out_obj[key] = candidate or mt
                    context_cache[src_original] = out_obj[key]
                else:
                    out_obj[key] = mt
                    plain_cache[src_original] = mt
                translated_count += 1
            pending = []

        for k in base_keys:
            src = en_obj.get(k, "")
            current = locale_obj.get(k, src)
            if not (args.force or current == src):
                out_obj[k] = current
                continue
            if args.max and translated_count >= args.max:
                out_obj[k] = current
                continue
            if not isinstance(src, str) or not src.strip():
                out_obj[k] = src
                continue

            if should_contextualize(src):
                if src in context_cache:
                    out_obj[k] = context_cache[src]
                    continue
                wrapped = f"The button says: {src}"
                protected, mapping = protect_text(wrapped)
                pending.append((k, "context", src, protected, mapping))
                flush_pending()
                continue

            if src in plain_cache:
                out_obj[k] = plain_cache[src]
                continue

            protected, mapping = protect_text(src)
            pending.append((k, "plain", src, protected, mapping))
            if len(pending) >= args.batch_size:
                flush_pending()

        flush_pending()

        # Preserve any locale-only keys
        for k, v in locale_obj.items():
            if k not in out_obj:
                out_obj[k] = v

        if not args.dry_run:
            write_json(target_path, out_obj)

        translated_locales.append({"locale": locale, "model": model_name, "device": device})

    print(
        json.dumps(
            {
                "dryRun": args.dry_run,
                "baseKeys": len(base_keys),
                "translatedLocales": translated_locales,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
