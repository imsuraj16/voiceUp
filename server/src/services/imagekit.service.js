const Imagekit = require("imagekit");
const { v4: uuidv4 } = require("uuid");
const config = require("../config/config");

const imagekit = new Imagekit({
  publicKey: config.IMAGEKIT_PUBLIC_KEY,
  privateKey: config.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: config.IMAGEKIT_URL_ENDPOINT,
});

const uploadFile = async (file) => {
  try {
    const result = await imagekit.upload({
      file: file.buffer,
      fileName: uuidv4(),
  folder: "voiceup",
    });

    return result;
  } catch (error) {
    return error;
  }
};

module.exports = uploadFile;
