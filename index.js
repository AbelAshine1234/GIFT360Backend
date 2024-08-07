const axios = require('axios');
var payloads=require('./payload');
const fs = require('fs');
require('dotenv').config();
const CLIENT_ID =process.env.CLIENT_ID;
const CLIENT_SECRET =process.env.CLIENT_SECRET;


// Generates token with clientid and client secret
async function getToken(CLIENT_ID, CLIENT_SECRET) {
    const BASE_URL = process.env.BASE_URL;
    const AUTH_ROUTE = process.env.AUTH_ROUTE;
    const url = `${BASE_URL}${AUTH_ROUTE}`;
    const authPayload = payloads.createAuthTokenPayload(CLIENT_ID, CLIENT_SECRET);
    const payload = JSON.stringify(authPayload);
    const headers = payloads.setAuthHeaders();
  
    try {
      let response =await axios.post(url,payload,{
        headers: headers
      })
      return response.data.access_token;
    } catch (e) {
      console.error(`Error while fetching token: ${e}`);
      return null;
    }
  }
  
  async function generateUploadUrl(token) {
    const BASE_URL = process.env.BASE_URL;
    const GENERATEURL_ROUTE = process.env.GENERATEURL_ROUTE;
    const USER_ID = process.env.USER_ID;
    const url = `${BASE_URL}${GENERATEURL_ROUTE}`;
    const headers = payloads.setHeaders(token, USER_ID);
    const generateUrlPayload = payloads.createGenerateUrlPayload('testvideo.mp4');
    const payload = JSON.stringify(generateUrlPayload);
  
    try {
      let response = await axios.post(url,payload, {
        headers: headers
      });
      return response.data.data;
    } catch (e) {
      console.error(`Error while generate url: ${e}`);
      return null;
    }
  }
  // Upload video function
async function uploadVideo(url, videoName, videoPath) {
  const headers = { "Content-Type": "video/mp4" };
  console.log("file path before",videoPath)
  
  const videoData = await new Promise((resolve, reject) => {
    const filePath = `${videoPath}/${videoName}`;
    console.log("file path after",filePath)
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });

  try {
    let response = await axios.put(url, videoData, { headers });
    console.log("Video uploaded successfully!");
    return response;
  } catch (e) {
    console.error(`Error uploading video: ${e}`);
  }
}

// Create transcription function
async function createTranscription(token, fileUrl, language) {
  const BASE_URL = process.env.BASE_URL;
  const TRANSCRIPTION_ROUTE = process.env.TRANSCRIPTION_ROUTE;
  const USER_ID = process.env.USER_ID;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  const url = `${BASE_URL}${TRANSCRIPTION_ROUTE}`;
  const transcriptionPayload = payloads.createTranscriptionPayload(
    fileUrl,
    language,
    WEBHOOK_URL
  );
  const headers = payloads.setHeaders(token, USER_ID);

  try {
    let response = await axios.post(url, transcriptionPayload, { headers });
    const jobId = response.data.data.jobId;
    return jobId;
  } catch (e) {
    console.error(`Error while storyboard: ${e}`);
    return null;
  }
}

// Get job status function
async function getJobId(token, jobId) {
  const BASE_URL = process.env.BASE_URL;
  const GET_JOB_ROUTE = process.env.GET_JOB_ROUTE;
  const USER_ID = process.env.USER_ID;
  const url = `${BASE_URL}${GET_JOB_ROUTE}${jobId}`;
  const headers = payloads.setHeaders(token, USER_ID);

  try {
    let response = await axios.get(url, { headers });
    return response.data.data;
  } catch (e) {
    console.error(`Error while get jobid: ${e}`);
    return null;
  }
}
// Waits for transcription job to get complete
async function waitForTranscriptionJobToComplete(token, jobid) {
  let response = await getJobId(token, jobid);
  while (JSON.stringify(response).includes("in-progress")) {
    response = await getJobId(token, jobid);
  }
  return response;
}

async function createFinalTranscription(videoName, videoPath) {
  const token = await getToken(CLIENT_ID, CLIENT_SECRET);
  const data = await generateUploadUrl(token);
  await uploadVideo(data.signedUrl, videoName, videoPath);
  const jobid = await createTranscription(token, data.url, "en-US");
  const transcriptiondata = await waitForTranscriptionJobToComplete(
    token,
    jobid
  );
  return transcriptiondata;
}

// createFinalTranscription("h.mp4", "C:\\Users\\Abel\\Downloads\\");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(bodyParser.json());
app.use(cors());

const port = 5000;
function addBackslashes(inputString) {
  return inputString.replace(/\\/g, "\\\\");
}

app.post("/transcribe-video", async (req, res) => {
  if (!req.body.filePath || !req.body.fileName) {
    return res
      .status(400)
      .send("Missing required fields: filePath or fileName");
  }
  const { filePath, fileName } = req.body;
  const urlFile = addBackslashes(filePath); // Ensure this function is defined

  try {
    const transcriptionText = await createFinalTranscription(fileName, urlFile);
    return res.json({ transcriptionText });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Failed to process the video transcription.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
