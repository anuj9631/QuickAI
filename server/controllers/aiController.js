import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import fs from 'fs';

// --- ROBUST PDF IMPORTER ---
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfLib = require("pdf-parse");

const parsePDF = async (buffer) => {
  try {
    // Attempt 1: Standard Function Call (CommonJS standard)
    return await pdfLib(buffer);
  } catch (err) {
    // If it crashes saying "needs new", we invoke it as a constructor
    if (err.message && err.message.includes("without 'new'")) {
       const PDFClass = pdfLib; 
       return new PDFClass(buffer);
    }
    
    // Attempt 2: Check for .default (ESM Wrapper)
    if (pdfLib.default) {
        try {
            return await pdfLib.default(buffer);
        } catch (e) {
            if (e.message && e.message.includes("without 'new'")) {
                const PDFClass = pdfLib.default;
                return new PDFClass(buffer);
            }
        }
    }

    // Attempt 3: If it's the internal PDFParse class (from your earlier logs)
    if (pdfLib.PDFParse) {
        // The library stores the result promise in .promise property
        // We pass an empty options object {} to prevent crashes
        const parser = new pdfLib.PDFParse(buffer, {});
        return parser.promise; 
    }
    
    throw err;
  }
};
// ---------------------------

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, length } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({ success: false, message: "Limit reached. Upgrade to continue." });
    }

    const response = await AI.chat.completions.create({
      model: "gemini-2.5-flash", 
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: length * 2,
    });

    const content = response.choices[0].message.content;
    await sql`INSERT INTO creations (user_id, prompt,content,type) VALUES (${userId}, ${prompt}, ${content}, 'article')`;
    
    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, { privateMetadata: { free_usage: free_usage + 1 } });
    }
    res.json({ success: true, content });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({ success: false, message: "Limit reached. Upgrade to continue." });
    }

    const response = await AI.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    await sql`INSERT INTO creations (user_id, prompt,content,type) VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`;
    
    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, { privateMetadata: { free_usage: free_usage + 1 } });
    }
    res.json({ success: true, content });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({ success: false, message: "Premium subscription required" });
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      { headers: { "x-api-key": process.env.CLIPDROP_API_KEY }, responseType: "arraybuffer" }
    );

    const base64Image = `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;
    const { secure_url } = await cloudinary.uploader.upload(base64Image);

    await sql`INSERT INTO creations (user_id, prompt,content,type, publish) VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`;
    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const removeImageBackground = async (req, res) => {
  try {
    const { userId } = req.auth();
    const image = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({ success: false, message: "Premium subscription required" });
    }

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [{ effect: "background_removal", backgroud_removal: "remove_the_background" }],
    });

    await sql`INSERT INTO creations (user_id, prompt,content,type) VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')`;
    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const removeImageObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
    const image = req.file;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({ success: false, message: "Premium subscription required" });
    }

    const { public_id } = await cloudinary.uploader.upload(image.path);
    const imageUrl = cloudinary.url(public_id, {
        transformation:[{effect: `gen_remove:${object}`}],
        resource_type: 'image'
    })

    await sql`INSERT INTO creations (user_id, prompt,content,type) VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')`;
    res.json({ success: true, content: imageUrl });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const resumeReview = async (req, res) => {
    try {
      const { userId } = req.auth();
      const resume = req.file;
      const plan = req.plan;
  
      if (plan !== "premium") {
        return res.json({ success: false, message: "Premium subscription required" });
      }
  
      if(resume.size > 5 * 1024 * 1024){
        return res.json({success: false, message: "Resume file size exceeds allows size (5MB)."})
      }

      const dataBuffer = fs.readFileSync(resume.path);
      
      // Use the universal parser
      const pdfData = await parsePDF(dataBuffer);

      // Verify text extraction
      if (!pdfData || !pdfData.text) {
          console.warn("PDF Text extraction returned empty.");
      }

      const extractedText = pdfData?.text || "No readable text found in this PDF.";
      const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses, and ares for improvement. Resume Content: \n\n${extractedText}`

      const response = await AI.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });
  
      const content = response.choices[0].message.content;
      await sql`INSERT INTO creations (user_id, prompt,content,type) VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')`;
  
      res.json({ success: true, content });
    } catch (error) {
      console.log("Resume Error:", error.message);
      res.json({ success: false, message: error.message });
    }
  };