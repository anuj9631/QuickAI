import sql from "../config/dg.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import fs from "fs";
import * as pdf from "pdf-parse";

// Generate Article
export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, length } = req.body;
    const { plan, free_usage } = req;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({ success: false, message: "Limit Reached. Upgrade to continue." });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;

    await sql`INSERT INTO creations(user_id, prompt, content, type)
              VALUES(${userId}, ${prompt}, ${content}, 'article')`;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: free_usage + 1 },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log("ARTICLE ERROR:", error.response?.data || error.message);
    res.json({ success: false, message: "Something went wrong" });
  }
};

// Generate Blog Title
export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const { plan, free_usage } = req;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({ success: false, message: "Limit Reached. Upgrade to continue." });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;

    await sql`INSERT INTO creations(user_id, prompt, content, type)
              VALUES(${userId}, ${prompt}, ${content}, 'blog-article')`;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: free_usage + 1 },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log("BLOG TITLE ERROR:", error.response?.data || error.message);
    res.json({ success: false, message: "Something went wrong" });
  }
};

// Generate Image
export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({ success: false, message: "Premium only feature" });
    }

    const formData = new FormData();
    formData.append("prompt", prompt);

    const { data } = await axios.post("https://clipdrop-api.co/text-to-image/v1", formData, {
      headers: { "x-api-key": process.env.CLIPDROP_API_KEY },
      responseType: "arraybuffer",
    });

    const base64Image = `data:image/png;base64,${Buffer.from(data).toString("base64")}`;
    const imgUrl = base64Image;

    await sql`INSERT INTO creations(user_id, prompt, content, type, publish)
              VALUES(${userId}, ${prompt}, ${imgUrl}, 'image', ${publish ?? false})`;

    res.json({ success: true, content: imgUrl });
  } catch (error) {
    console.log("IMAGE ERROR:", error.response?.data || error.message);
    res.json({ success: false, message: "Image generation failed" });
  }
};

// Remove Background
export const removeImageBackground = async (req, res) => {
  try {
    const image = req.file;
    const plan = req.plan;

    if (!image) return res.json({ success: false, message: "No image provided" });
    if (plan !== "premium") return res.json({ success: false, message: "Premium only feature" });

    res.json({ success: true, content: "Background removed ❌ Placeholder" });
  } catch (error) {
    console.log("REMOVE BG ERROR:", error.message);
    res.json({ success: false, message: "Failed to remove background" });
  }
};

// Remove Object
export const removeImageObject = async (req, res) => {
  try {
    res.json({ success: false, message: "Object removal coming soon" });
  } catch (error) {
    console.log("REMOVE OBJECT ERROR:", error.message);
    res.json({ success: false, message: "Failed to remove object" });
  }
};

// Resume Review
export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;

    if (!resume) return res.json({ success: false, message: "Upload a resume first" });

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    const prompt = `Review resume:\n\n${pdfData.text}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;

    res.json({ success: true, content });
  } catch (error) {
    console.log("RESUME REVIEW ERROR:", error.response?.data || error.message);
    res.json({ success: false, message: "Resume review failed" });
  }
};
