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

## Windows security notice

Windows may display a SmartScreen warning because the application is not signed with a commercial code-signing certificate. Check that the file was downloaded from the official release link above before choosing **More info** and **Run anyway**.

## For developers

The application is an Electron desktop app. To run it from source, install Node.js, then run:

```powershell
npm install
npm start
```

To build the Windows installer and portable executable:

```powershell
npm run package
```

The generated files are placed in the `release` folder.
