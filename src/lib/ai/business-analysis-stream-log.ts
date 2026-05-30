type LogDetail = Record<string, unknown> | undefined;

function formatDetail(detail: LogDetail): string {
  if (!detail) return '';
  try {
    return ` ${JSON.stringify(detail)}`;
  } catch {
    return ' [unserializable detail]';
  }
}

export const businessAnalysisLog = {
  api(step: string, detail?: LogDetail) {
    console.info(`[business-analysis:api] ${step}${formatDetail(detail)}`);
  },
  generator(step: string, detail?: LogDetail) {
    console.info(`[business-analysis:generator] ${step}${formatDetail(detail)}`);
  },
  ui(step: string, detail?: LogDetail) {
    console.info(`[business-analysis:ui] ${step}${formatDetail(detail)}`);
  },
};

/** Wrap fetch to log how many HTTP chunks arrive (diagnoses streaming vs single blob). */
export function createBusinessAnalysisLoggingFetch(scope: 'basic' | 'extended') {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    businessAnalysisLog.ui(`${scope}-fetch-start`, {
      url: String(url),
      body: init?.body ? String(init.body).slice(0, 200) : undefined,
    });

    const response = await fetch(url, init);
    businessAnalysisLog.ui(`${scope}-fetch-response`, {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
    });

    if (!response.body) return response;

    let chunkCount = 0;
    let byteCount = 0;
    const reader = response.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          businessAnalysisLog.ui(`${scope}-fetch-complete`, { chunkCount, byteCount });
          controller.close();
          return;
        }
        chunkCount += 1;
        byteCount += value.byteLength;
        if (chunkCount === 1 || chunkCount % 5 === 0) {
          businessAnalysisLog.ui(`${scope}-fetch-chunk`, {
            chunkCount,
            byteCount,
            chunkBytes: value.byteLength,
          });
        }
        controller.enqueue(value);
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}
