import JSZip from "jszip";

interface WebkitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

interface WebkitFileSystemFileEntry extends WebkitFileSystemEntry {
  file: (successCallback: (file: File) => void, errorCallback?: (error: Error) => void) => void;
}

interface WebkitFileSystemDirectoryEntry extends WebkitFileSystemEntry {
  createReader: () => WebkitFileSystemDirectoryReader;
}

interface WebkitFileSystemDirectoryReader {
  readEntries: (
    successCallback: (entries: WebkitFileSystemEntry[]) => void,
    errorCallback?: (error: Error) => void
  ) => void;
}

async function readEntriesRecursively(
  dirEntry: WebkitFileSystemDirectoryEntry,
  basePath = ""
): Promise<{ file: File; relativePath: string }[]> {
  const dirReader = dirEntry.createReader();
  const entries: WebkitFileSystemEntry[] = [];

  while (true) {
    const batch = await new Promise<WebkitFileSystemEntry[]>((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
    if (batch.length === 0) break;
    entries.push(...batch);
  }

  const results: { file: File; relativePath: string }[] = [];
  for (const entry of entries) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as WebkitFileSystemFileEntry).file(resolve, reject);
      });
      results.push({ file, relativePath: entryPath });
    } else if (entry.isDirectory) {
      const subResults = await readEntriesRecursively(
        entry as WebkitFileSystemDirectoryEntry,
        entryPath
      );
      results.push(...subResults);
    }
  }
  return results;
}

export async function zipFiles(
  folderName: string,
  filesWithPaths: { file: File; relativePath: string }[],
  onProgress?: (msg: string) => void
): Promise<File> {
  const zip = new JSZip();
  for (const item of filesWithPaths) {
    zip.file(item.relativePath, item.file);
  }

  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(`Compressing ${folderName}... (${Math.round(metadata.percent)}%)`);
      }
    }
  );

  return new File([blob], `${folderName}.zip`, { type: "application/zip" });
}

export async function processDroppedOrSelectedFiles(
  dataTransferItems: DataTransferItemList | null,
  fileList: FileList | File[] | null,
  onProgress?: (msg: string) => void
): Promise<File[]> {
  const outputFiles: File[] = [];

  // 1. Check DataTransferItemList (Drag & Drop)
  if (dataTransferItems && dataTransferItems.length > 0) {
    const items = Array.from(dataTransferItems);
    for (const item of items) {
      if (item.kind !== "file") continue;
      const getAsEntry = item.webkitGetAsEntry || (item as any).getAsEntry;
      const entry = getAsEntry ? (getAsEntry.call(item) as WebkitFileSystemEntry | null) : null;

      if (entry && entry.isDirectory) {
        onProgress?.(`Reading folder: ${entry.name}...`);
        const filesWithPaths = await readEntriesRecursively(entry as WebkitFileSystemDirectoryEntry);
        if (filesWithPaths.length > 0) {
          const zippedFile = await zipFiles(entry.name, filesWithPaths, onProgress);
          outputFiles.push(zippedFile);
        }
      } else if (entry && entry.isFile) {
        const file = item.getAsFile();
        if (file) outputFiles.push(file);
      } else {
        const file = item.getAsFile();
        if (file) outputFiles.push(file);
      }
    }
    onProgress?.("");
    return outputFiles;
  }

  // 2. Check FileList or File[] (File Input / Folder Input selection)
  if (fileList) {
    const files = Array.from(fileList);
    const hasFolder = files.some((f) => f.webkitRelativePath && f.webkitRelativePath.includes("/"));

    if (hasFolder) {
      const folderGroups: Record<string, { file: File; relativePath: string }[]> = {};
      const standaloneFiles: File[] = [];

      for (const file of files) {
        if (file.webkitRelativePath && file.webkitRelativePath.includes("/")) {
          const parts = file.webkitRelativePath.split("/");
          const rootFolder = parts[0];
          const relPath = parts.slice(1).join("/") || file.name;
          if (!folderGroups[rootFolder]) folderGroups[rootFolder] = [];
          folderGroups[rootFolder].push({ file, relativePath: relPath });
        } else {
          standaloneFiles.push(file);
        }
      }

      outputFiles.push(...standaloneFiles);

      for (const [folderName, items] of Object.entries(folderGroups)) {
        if (items.length > 0) {
          const zippedFile = await zipFiles(folderName, items, onProgress);
          outputFiles.push(zippedFile);
        }
      }
      onProgress?.("");
      return outputFiles;
    } else {
      outputFiles.push(...files);
    }
  }

  onProgress?.("");
  return outputFiles;
}
