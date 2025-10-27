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

// GET /api/issues — list issues with filters and sorting
// Supported query params:
// - bbox: "minLng,minLat,maxLng,maxLat"
// - category: one of issueModel enum
// - status: one of [reported, in_progress, resolved]
// - sort: one of [createdAt, -createdAt, aiScore, -aiScore, votesCount, -votesCount]
const listIssues = async (req, res) => {
  try {
    const { q, bbox, category, status, sort, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (q) {
      filter.$text = { $search: q };
    }

    if (bbox) {
      const coords = bbox.split(",").map(Number);
      if (coords.length === 4 && coords.every((num) => !isNaN(num))) {
        // Validate longitude [-180, 180] and latitude [-90, 90]
        const [minLon, minLat, maxLon, maxLat] = coords;
        if (minLon >= -180 && maxLon <= 180 && minLat >= -90 && maxLat <= 90) {
          filter.location = {
            $geoWithin: {
              $box: [
                [minLon, minLat],
                [maxLon, maxLat],
              ],
            },
          };
        } else {
          return res.status(400).json({ message: "Invalid bbox range" });
        }
      } else {
        return res.status(400).json({ message: "Invalid bbox format" });
      }
    }

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    let sortOption = { createdAt: -1 }; // default: newest first

    if (sort) {
      if (sort.startsWith("-")) {
        const field = sort.substring(1);
        if (["createdAt", "aiScore", "votesCount"].includes(field)) {
          sortOption = { [field]: -1 };
        }
      } else if (["createdAt", "aiScore", "votesCount"].includes(sort)) {
        sortOption = { [sort]: 1 };
      }
    }

    const skip = (page - 1) * limit;

    const issues = await issueModel
      .find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await issueModel.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Issues retrieved successfully",
      data: issues,
      count: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


//update issue
const updateIssues = async(req,res)=>{

  const{issueId} = req.params;
  const userId = req.user._id;
  
  if(!userId){
    return res.status(401).json({message:"Unauthorized"});
  }

  const { title, description, category, location, address, status } = req.body;

  if(!issueId){
    return res.status(400).json({message:"Issue ID is required"});
  }


  const updateIssue = await issueModel.findOneAndUpdate({
    _id : issueId,
    reporterId : userId
  },{
    title,
    description,
    category,
    location,
    address,
    status
  },{
    new : true,
  })

  if(!updateIssue){
    return res.status(404).json({message:"Issue not found or you are not authorized to update this issue"});
  }

  return res.status(200).json({
    message : "Issue updated successfully",
    issue : updateIssue
  })

}


module.exports = {
  addIssue,
  listIssues,
  updateIssues
};
