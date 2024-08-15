// Hack4impact's Awesomely Intuitive Resume Booklet Assembly and Layout Library (HAIRBALL)
// (c) Zavier Miller 2024

const process = require('process');
const fs = require('fs');
const cp = require('child_process');
const util = require('util');
const readline = require('node:readline');
const exec = util.promisify(cp.exec);
const path = require('path');

const NAME_COLUMN_IDX = 0;
const EMAIL_COLUMN_IDX = 3;
const DOC_TO_PDF_POSSIBLE_COMMANDS = {
  lowriter: {
    commandString: (docPath, workingDir) =>
      `lowriter --convert-to pdf --outdir ${workingDir} '${docPath}'`,
  },
};

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function getDoc2PdfCommand() {
  for (const command in DOC_TO_PDF_POSSIBLE_COMMANDS) {
    try {
      await exec(`which ${command}`);
      return DOC_TO_PDF_POSSIBLE_COMMANDS[command];
    } catch (e) {}
  }
}

function getActiveMembers(activeMembersCsv) {
  return activeMembersCsv
    .split('\n')
    .filter((_line, idx) => idx !== 0)
    .map((line) => line.split(','))
    .map((member) => ({
      name: member[NAME_COLUMN_IDX],
      email: member[EMAIL_COLUMN_IDX],
    }));
}

async function getActiveMemberResumes(activeMembers, resumeFolder) {
  let skipAllConfirmations = false;

  // get each file in the resume folder
  const resumeFiles = fs.readdirSync(resumeFolder);
  const resumeSet = new Set(activeMembers);
  const activeMemberResumes = {};

  for (const resumeFile of resumeFiles) {
    const correspondingMember = activeMembers.find((member) => {
      return resumeFile.includes(member);
    });

    // skip resumes weve already seen
    if (!resumeSet.has(correspondingMember)) {
      continue;
    }

    if (!skipAllConfirmations && !correspondingMember) {
      const answer = await askQuestion(
        `Found resume ${resumeFile}. Skip? [Yna] (y = yes, n = no, a = yes to all)\n`
      );
      if (answer === 'n') {
        // activeMemberResumes.push(resumeFile);
        const memberName = await askQuestion('What is their full name?\n');
        activeMembers.push(memberName);
        resumeSet.delete(memberName);
        activeMemberResumes[memberName] = resumeFile;
      } else if (answer === 'a') {
        skipAllConfirmations = true;
      }
    } else if (correspondingMember) {
      activeMemberResumes[correspondingMember] = resumeFile;
      resumeSet.delete(correspondingMember);
    }
  }

  return [activeMemberResumes, Array.from(resumeSet)];
}

async function copyActiveMemberResumes(activeMemberResumes, resumeFolder) {
  const newResumeFolder = path.join(resumeFolder, '.working-pdfs');
  // attempt to mkdir
  try {
    fs.mkdirSync(newResumeFolder);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.error(`Error creating ${newResumeFolder}`);
      process.exit(1);
    }
  }

  for (const memberName in activeMemberResumes) {
    const resumeFile = activeMemberResumes[memberName];
    const resumePath = path.join(resumeFolder, resumeFile);
    const newPath = path.join(
      newResumeFolder,
      `${memberName}${path.extname(resumeFile)}`
    );
    fs.copyFileSync(resumePath, newPath);
  }
}

async function convertDocsToPdf(resumeFolder, doc2pdfCommand) {
  const convertedResumePaths = [];
  const newResumeFolder = path.join(resumeFolder, '.working-pdfs');
  // read the folder
  let activeMemberResumes;
  try {
    activeMemberResumes = fs.readdirSync(newResumeFolder);
  } catch (e) {
    console.error(`Error reading ${resumeFolder}`);
    process.exit(1);
  }

  for (const resumeFile of activeMemberResumes) {
    const resumePath = path.join(newResumeFolder, resumeFile);
    if (path.extname(resumeFile).includes('doc')) {
      const convertCmd = doc2pdfCommand.commandString(
        resumePath,
        newResumeFolder
      );
      try {
        await exec(convertCmd);

        // attempt to rename the file
        const newPath = path.join(
          newResumeFolder,
          resumeFile.replace(/\.docx?/, '.pdf')
        );
        // fs.renameSync(resumePath, newPath);
        convertedResumePaths.push(newPath);
      } catch (e) {
        console.error(`Error converting ${resumePath} to pdf`);
      }
    } else if (path.extname(resumeFile).includes('pdf')) {
      convertedResumePaths.push(resumePath);
    }
  }

  return convertedResumePaths;
}

async function main() {
  // guards
  if (process.argv.length < 4) {
    console.error('Usage: node hairball.js <members csv> <resume folder>');
    process.exit(1);
  }
  if (!fs.existsSync(process.argv[2])) {
    console.error('Error: Active members CSV does not exist');
    process.exit(1);
  }
  if (!fs.existsSync(process.argv[3])) {
    console.error('Error: Resume folder does not exist');
    process.exit(1);
  }

  try {
    await exec('which pdfunite');
  } catch (e) {
    console.error(
      'Error: pdfunite not found, please install it to use this tool.'
    );
    process.exit(1);
  }

  // get the command we will be using to convert doc to pdf
  const doc2pdfCommand = await getDoc2PdfCommand();
  if (!doc2pdfCommand) {
    console.error(
      'Error: No command found to convert doc to pdf, tried',
      Object.keys(DOC_TO_PDF_POSSIBLE_COMMANDS).join(', ')
    );
    process.exit(1);
  }

  // read the members csv and parse out the information
  const membersCsv = fs.readFileSync(process.argv[2], 'utf8');
  const activeMembers = getActiveMembers(membersCsv);
  const [activeMemberResumes, missingResumes] = await getActiveMemberResumes(
    activeMembers.map((member) => member.name),
    process.argv[3]
  );
  copyActiveMemberResumes(activeMemberResumes, process.argv[3]);

  console.log('Converting resumes to pdf...');
  const convertedResumePaths = await convertDocsToPdf(
    process.argv[3],
    doc2pdfCommand
  );

  // finally, combine the pdfs
  const pdfUniteCommand = `pdfunite ${convertedResumePaths
    .map((path) => `'${path}'`)
    .join(' ')} resume_booklet.pdf`;
  try {
    await exec(pdfUniteCommand);
  } catch (e) {
    console.error('Error combining pdfs');
    console.error(e);
    process.exit(1);
  }

  console.log('Successfully created resume_booklet.pdf');
  fs.rmSync(path.join(process.argv[3], '/.working-pdfs'), {
    recursive: true,
    force: true,
  });
  if (missingResumes.length > 0) {
    const answer = await askQuestion(
      `Warning: Missing resumes from ${missingResumes.length} members. Would you like their emails? [Yn] (y = yes, n = no)\n`
    );
    if (answer === 'y') {
      for (const name of missingResumes) {
        const email = activeMembers.find(
          (member) => member.name === name
        ).email;
        console.log(`${email}`);
      }
    }
  }
}

main();
