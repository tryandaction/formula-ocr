# Phase 5 DOCX and Markdown Evidence

Date: 2026-09-20

## Supported Paths

- Markdown is parsed from source delimiters (`$...$`, `$$...$$`, `\\(...\\)`, `\\[...\\]`) while fenced/inline code and escaped dollars are masked. Existing LaTeX is preserved and is not sent through visual OCR.
- DOCX is parsed in-browser from OOXML using `fflate` and `DOMParser`. Common OMML fractions, superscripts, subscripts, roots, matrices, and embedded PNG/JPEG/WebP formula images are returned with paragraph/source metadata.
- Embedded formula images remain eligible for the selected image Provider; OMML is returned as editable LaTeX with `needs_review` status because conversion is conservative.
- Legacy OLE/Equation Editor objects are not silently converted; they produce paragraph-level warnings asking the user to convert to PDF or an image.

## Fixtures and Tests

- `src/test/fixtures/documents/formulas.md` covers inline/display formulas, code fences, escaped dollars, and source preservation.
- `src/test/fixtures/documents/unclosed-formula.md` covers an unclosed delimiter.
- `documentImportRegression.test.ts` builds an actual OOXML ZIP fixture with OMML fraction/superscript and tests a corrupt archive.
- `documentFormats.test.ts` verifies Markdown parsing and the public support matrix now includes DOCX.
- `FormulaWorkbench.tsx` already routes DOCX bytes through `readDocx`; the legacy `DocumentUploader` now uses the same parser instead of showing “DOCX 暂不支持”.

## Verification

| Command | Result |
|---|---|
| DOCX/Markdown targeted tests | 2 files, 8/8 passed |
| Source formulas | preserved as editable source; no OCR request |
| Corrupt DOCX | explicit parser error from `readDocx` |

## Remaining Limits

- OLE/legacy Equation Editor objects remain unsupported and are reported as warnings.
- DOCX embedded image results need the normal OCR Provider and can be `queued`/`needs_review`; no model accuracy is inferred from source parsing.
- This phase does not claim PDF visual OCR or DOCX image OCR accuracy.
