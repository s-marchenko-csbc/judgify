import { API_BASE } from "../api/client";

function normalizeUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/")) {
    return `${API_BASE.replace(/\/api\/?$/, "")}${url}`;
  }
  return url;
}

export function getFileUrl(file) {
  return normalizeUrl(file?.download_url || file?.file_url || file?.url || "");
}

export function getMaterialUrl(material) {
  return normalizeUrl(material?.download_url || material?.file_url || material?.url || getFileUrl(material?.file) || "");
}

export function getMaterialTitle(material, fallback = "Material") {
  return material?.name || material?.title || material?.original_name || material?.file?.original_name || fallback;
}

export function getMaterialMeta(material, t) {
  const type = material?.material_type
    ? t?.(`options.material_type.${material.material_type}`, { defaultValue: material.material_type }) || material.material_type
    : "";
  const fileName = material?.original_name || material?.file?.original_name || "";
  const size = formatFileSize(material?.size_bytes || material?.file?.size_bytes);
  return [type, fileName, size].filter(Boolean).join(" - ");
}

export function getMaterialBadge(material) {
  const type = material?.material_type || material?.file?.file_type || "";
  const extension = (material?.original_name || material?.file?.original_name || "").split(".").pop();
  const label = extension && extension.length <= 5 ? extension : type;
  return String(label || "file").slice(0, 5).toUpperCase();
}

export function formatFileSize(sizeBytes) {
  const size = Number(sizeBytes || 0);
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
