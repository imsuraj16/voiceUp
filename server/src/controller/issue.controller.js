const issueModel = require("../models/issues/issue.model");
const generateResponse = require("../services/ai.service");
const uploadFile = require("../services/imagekit.service");

const addIssue = async (req, res) => {
  try {
    const userid = req.user._id;

    const { title, description, category, location, address, status } =
      req.body;

    const { files } = req;

    const file = await Promise.all(
      files.map(async (file) => {
        const data = await uploadFile(file);
        return data;
      })
    );

    const aiData = await generateResponse(description);

    const issue = await issueModel.create({
      title,
      description,
      category,
      location,
      address,
      status,
      images: file.map((file) => file.url),
      reporterId: userid,
      aiScore: aiData.severityScore,
      aiSuggestions: aiData.suggestedAction,
    });

    return res.status(201).json({
      message: "Issue created successfully",
      issue,
    });
    
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { addIssue };
