const startUpload = async (uploadId: string) => {
  const upload = uploads[uploadId];
  if (!upload || !id) return;

  setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'uploading', progress: 0 } }));

  try {
    // 1. Gerar URL direto do Worker
    const workerUrl = 'https://nameless-dust-4193.boranovfilms.workers.dev/api/upload';
    const response = await fetch(workerUrl, { method: 'POST' });
    const data = await response.json();
    
    if (!data.success || !data.result?.uploadURL) {
      throw new Error('Worker não retornou URL');
    }
    
    const { uid, uploadURL } = data.result;
    
    // 2. Upload DIRETO pro Cloudflare Stream (NÃO passa por proxy)
    const xhr = new XMLHttpRequest();
    activeRequests.current[uploadId] = xhr;

    xhr.open('PUT', uploadURL, true);
    xhr.setRequestHeader('Content-Type', upload.file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], progress } }));
      }
    };

    xhr.onload = async () => {
      delete activeRequests.current[uploadId];
      
      if (xhr.status === 200 || xhr.status === 201 || xhr.status === 204) {
        const streamUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/watch`;
        const thumbnailUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;

        await mediaService.addMedia(id!, {
          externalId: uid,
          name: upload.file.name,
          url: streamUrl,
          thumbnailUrl: thumbnailUrl,
          type: 'video',
          isSelected: false
        });

        setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'completed', progress: 100 } }));
        setTimeout(loadInitialData, 1000);
      } else {
        alert(`Erro no Cloudflare (${xhr.status})`);
        setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } }));
      }
    };

    xhr.onerror = () => {
      delete activeRequests.current[uploadId];
      alert('Erro de conexão no upload.');
      setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } }));
    };

    xhr.send(upload.file);
  } catch (error: any) {
    alert(`Erro: ${error.message}`);
    setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } }));
  }
};
