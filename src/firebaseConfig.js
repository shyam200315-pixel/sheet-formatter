// This file replaces the Firebase integration with a custom NestJS REST API backend.
// We kept the file name `firebaseConfig.js` temporarily so we don't have to change 
// import statements across the frontend codebase, ensuring a smooth transition.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/sync';

// Sync event listeners for UI status indicators
let syncListeners = [];
let currentSyncState = {
  status: "idle", // 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncedAt: null,
  errorMsg: null,
  cloudRowCount: 0
};

export function subscribeSyncStatus(listener) {
  syncListeners.push(listener);
  listener(currentSyncState);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
}

function updateSyncStatus(update) {
  currentSyncState = { ...currentSyncState, ...update };
  syncListeners.forEach(listener => {
    try {
      listener(currentSyncState);
    } catch (e) {
      console.warn("Sync listener error", e);
    }
  });
}

export function getSyncStatus() {
  return currentSyncState;
}

export async function saveToCloud(data, onProgress = null, appendMode = false) {
  updateSyncStatus({ status: "syncing", errorMsg: null });

  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      if (!appendMode) await clearFromCloud();
      return true;
    }

    const batchSize = 10000;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    // Send data in batches
    for (let i = 0; i < totalBatches; i++) {
      const batchData = data.slice(i * batchSize, (i + 1) * batchSize);
      
      if (onProgress) {
        onProgress({ 
          uploadedChunks: i + 1, 
          totalChunks: totalBatches, 
          uploadedRows: Math.min((i + 1) * batchSize, data.length), 
          totalRows: data.length 
        });
      }

      // If appendMode is true, ALWAYS append. Otherwise, only append after the first batch.
      const isAppend = appendMode ? true : (i > 0);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: batchData, isAppend }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }
    }

    // After all batches, get the final metadata update
    const metadataResp = await fetch(`${API_BASE}/metadata`);
    if (metadataResp.ok) {
      const result = await metadataResp.json();
      updateSyncStatus({
        status: "synced",
        lastSyncedAt: result.updatedAt || new Date().toISOString(),
        cloudRowCount: data.length
      });
    }

    return true;
  } catch (e) {
    console.warn("API Save Warning:", e.message);
    updateSyncStatus({
      status: "error",
      errorMsg: e.message
    });
    throw e;
  }
}

export async function loadFromCloud() {
  try {
    updateSyncStatus({ status: "syncing", errorMsg: null });

    const response = await fetch(`${API_BASE}/download`, {
      method: 'GET',
      cache: 'no-store', // Prevent browser from caching the GET request
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (response.status === 404) {
      updateSyncStatus({ status: "idle", cloudRowCount: 0 });
      return null;
    }

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    const allRows = result.data || [];

    updateSyncStatus({
      status: "synced",
      lastSyncedAt: result.updatedAt || new Date().toISOString(),
      cloudRowCount: allRows.length
    });

    return allRows.length > 0 ? allRows : null;
  } catch (e) {
    console.warn("API Load Warning (IndexedDB will be used):", e.message);
    updateSyncStatus({ status: "error", errorMsg: e.message });
    return null;
  }
}

export async function getCloudMetadata() {
  try {
    const response = await fetch(`${API_BASE}/metadata`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function clearFromCloud() {
  try {
    const response = await fetch(`${API_BASE}/clear`, { method: 'DELETE' });
    if (response.ok) {
      updateSyncStatus({ status: "idle", cloudRowCount: 0, lastSyncedAt: null });
      return true;
    }
    return false;
  } catch (e) {
    console.warn("API Clear Warning:", e.message);
    return false;
  }
}

export async function deleteFileFromCloud(fileId) {
  try {
    const response = await fetch(`${API_BASE}/file/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
    if (!response.ok) {
      console.warn("Delete file failed:", response.status, await response.text());
      return false;
    }
    const result = await response.json();
    console.log(`[deleteFileFromCloud] fileId=${fileId}, deletedCount=${result.deletedCount}`);
    return true;
  } catch (e) {
    console.warn("API Delete File Warning:", e.message);
    return false;
  }
}

export async function deleteDateFromCloud(dateStr) {
  try {
    const response = await fetch(`${API_BASE}/date/${dateStr}`, { method: 'DELETE' });
    return response.ok;
  } catch (e) {
    console.warn("API Delete Date Warning:", e.message);
    return false;
  }
}

// Dummy exports to prevent crashes if other files imported Firebase specific stuff
export const db = null;
export function getFirebaseConfig() { return null; }
