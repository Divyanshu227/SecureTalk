import api from "./axios";

export const uploadFile = async (encryptedBlob: Blob, filename: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", encryptedBlob, filename);

  const res = await api.post<{ url: string }>("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data.url;
};
