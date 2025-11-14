// src/utils/uploadAttachment.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export async function uploadAttachment(entryId, file) {
  const storageRef = ref(storage, `journalEntryFiles/${entryId}/${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { name: file.name, url };
}