# HAIRBALL

## Hack4Impact's Awesome Internal Resume Booklet Assembly and Layout Library

### Requirements

This library depends on the `pdfunite` (combining the PDFs) and `lowriter` (converting .doc[x] resumes to .pdf) tools. Install them on your machine for the easiest use.

You can add your tool of choice for converting .doc[x] files to .pdf by modifying adding it to the `DOC_TO_PDF_POSSIBLE_COMMANDS` constant in `hairball.js`. If you do this, please open a PR so that the library is more useful for everyone!

### Usage

1. Clone this repository
2. Consolidate all your resumes into a single folder (these can be resumes of both active and inactive members/non-members)
3. Download the CSV of our member directory spreadsheet
4. Run the following command:

```
node hairball.js <path to member csv> <path to resume folder>
```

And that's it! The script will find all active members based on who is in the CSV, and consolidate all resumes into a single PDF. The PDF will be saved in the same directory as the script as `resume_booklet.pdf`.
