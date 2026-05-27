// 文件上传工具：封装 uni.uploadFile，自动注入 token
const config = require("../config/api.js");
const auth = require("./auth.js");

/**
 * 上传文件到服务器
 * @param {string} filePath - 本地文件路径（uni.chooseImage 等返回的 tempFilePath）
 * @param {string} [module] - 业务模块标识（可选）
 * @returns {Promise<{ossPath: string, originalFilename: string}>}
 */
function uploadFile(filePath, module) {
  const token = auth.getToken();
  const tenantCode = auth.getTenantCode();
  const url = config.getUrl(config.file.upload);

  return new Promise((resolve, reject) => {
    const header = {};
    if (token) header["Authorization"] = "Bearer " + token;
    if (tenantCode) header["X-Tenant-Code"] = tenantCode;

    uni.uploadFile({
      url,
      filePath,
      name: "file",
      formData: module ? { module } : {},
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const body = JSON.parse(res.data);
            if (body.code === 200 || body.code === 0) {
              resolve(body.data);
            } else {
              reject(new Error(body.message || "上传失败"));
            }
          } catch (e) {
            reject(new Error("上传响应解析失败"));
          }
        } else if (res.statusCode === 401) {
          auth.redirectToLogin();
          reject(new Error("UNAUTHORIZED"));
        } else {
          reject(new Error("上传失败(" + res.statusCode + ")"));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || "上传失败"));
      }
    });
  });
}

module.exports = { uploadFile };
