#!/usr/bin/env python3
"""Remove the three Canva placeholder text elements from the certificate PDF.

The background, border, fixed headings, founder signature and decorative seal
remain untouched. Dynamic member name, course title and date are rendered by
the production certificate service.
"""

from pathlib import Path
import sys

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream


REMOVED_FONT_MARKERS = ("BurguesScript", "Montserrat-Bold", "Poppins-Regular")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Použití: prepare-certificate-pdf.py <vstup.pdf> <výstup.pdf>")

    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(source)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    removed_blocks = 0
    for page in writer.pages:
        xobjects = page["/Resources"].get("/XObject") or {}
        for reference in xobjects.values():
            form = reference.get_object()
            if form.get("/Subtype") != "/Form" or not form.get("/Resources"):
                continue

            font_resources = form["/Resources"].get("/Font") or {}
            dynamic_fonts = {
                name
                for name, font_ref in font_resources.items()
                if any(marker in font_base_name(font_ref.get_object()) for marker in REMOVED_FONT_MARKERS)
            }
            if not dynamic_fonts:
                continue

            stream = ContentStream(form, writer)
            next_operations = []
            text_block = []
            active_font = None
            in_text = False

            for operands, operator in stream.operations:
                if operator == b"BT":
                    in_text = True
                    active_font = None
                    text_block = [(operands, operator)]
                    continue
                if not in_text:
                    next_operations.append((operands, operator))
                    continue

                text_block.append((operands, operator))
                if operator == b"Tf" and operands:
                    active_font = operands[0]
                if operator == b"ET":
                    if active_font in dynamic_fonts:
                        removed_blocks += 1
                    else:
                        next_operations.extend(text_block)
                    in_text = False
                    active_font = None
                    text_block = []

            if text_block:
                next_operations.extend(text_block)
            stream.operations = next_operations
            form.set_data(stream.get_data())

    # Canva rozdělila kaligrafické jméno na dva překrývající se textové
    # objekty na každé stránce, proto jsou na stránku čtyři bloky.
    if removed_blocks != 8:
        raise RuntimeError(f"Očekáváno 8 dynamických textových bloků, odstraněno {removed_blocks}.")

    with destination.open("wb") as output:
        writer.write(output)


def font_base_name(font: object) -> str:
    descendants = font.get("/DescendantFonts") or [font]
    descendant = descendants[0].get_object()
    return str(descendant.get("/BaseFont") or font.get("/BaseFont") or "")


if __name__ == "__main__":
    main()
