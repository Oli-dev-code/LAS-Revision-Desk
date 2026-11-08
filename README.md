# LAS Revision Desk

Desktop revision software for LAS AAP training.

## Download and install

Most users only need this file:

**[Download the latest Windows installer](https://github.com/Oli-dev-code/LAS-Revision-Desk/releases/latest)**

1. Download the installer.
2. Run the `.exe` file.
3. Approve the Windows security prompt if it appears.
4. Open **LAS Revision Desk** from the desktop or Start menu.

You do **not** need to download the source code, course documents, Node.js or any other files.

## Portable version

To run the app without installing it, use the portable build:

**[Download the latest portable version](https://github.com/Oli-dev-code/LAS-Revision-Desk/releases/latest)**

Download it, place it in a suitable folder and run the `.exe` file.

## What is included

- Learning materials for the available LAS AAP anatomy and physiology topics
- Topic-filtered tests and quizzes
- 50 questions per topic, with explanations
- Test scores and missed-question review
- Topic completion tracking
- Light and dark modes

## Windows security and code signing

Published Windows installers and portable builds are signed with the LAS Revision Desk code-signing certificate. Windows should therefore show a verified publisher and SmartScreen warnings should be substantially reduced over time as the release reputation grows.

Local builds are not signed unless `CSC_LINK` and `CSC_KEY_PASSWORD` are supplied to electron-builder. Do not commit certificates or passwords to the repository.

## For developers

The application is an Electron desktop app. To run it from source, install Node.js, then run:

```powershell
npm install
npm start
```

Development launches also check the GitHub release feed using `dev-app-update.yml`. If an update is downloaded during development, it is reported but not installed over the unpackaged development build.

To build the Windows installer and portable executable:

```powershell
npm run package
```

The generated files are placed in the `release` folder.

### Release signing

The GitHub Actions release workflow expects these repository secrets:

- `WINDOWS_CERTIFICATE_BASE64`: the base64-encoded `.pfx` signing certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: the password for that certificate

When both secrets are present, the workflow writes the certificate to the temporary GitHub Actions runner and exposes it to electron-builder through `CSC_LINK` and `CSC_KEY_PASSWORD`. If either secret is missing, the workflow currently continues with an unsigned build and prints a warning. The certificate remains outside the repository.
