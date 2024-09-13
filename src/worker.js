// src/worker.js
var worker_default = {
	async fetch(request, env, ctx) {
		const reqClone = request.clone();
		const url = new URL(request.url);
		let targetURL = new URL('https://generativelanguage.googleapis.com');
		targetURL.pathname = url.pathname;
		targetURL.search = url.search;
		let headers = new Headers(request.headers);
		const apiKeyOptions = env.GOOGLE_APIKEY.split("|");
		const apiKey = headers.get('x-goog-api-key');
		let randomAutoApiKey;
		if (apiKey === env.OBFUSCATED_VALUES) {
			const randomApiKey = apiKeyOptions[Math.floor(Math.random() * apiKeyOptions.length)];
			randomAutoApiKey = randomApiKey;
			headers.set('x-goog-api-key', randomApiKey);
		}
		let newRequest = new Request(targetURL, {
			method: request.method,
			headers,
			body: request.body
		});
		const contentType = request.headers.get('content-type') || '';
		let response = await fetch(newRequest);
		const timestamp = getUTCDateTime();
		const userIP = request.headers.get('x-real-ip') || 'unkown';
		let data;
		try {
			let { cf } = reqClone;
			const country = cf.country || 'unknown';
			const city = cf.city || 'unknown';
			const latitude = cf.latitude || 'unknown';
			const longitude = cf.longitude || 'unknown';
			const timezone = cf.timezone || 'unknown';
			const asOrganization = cf.asOrganization || 'unknown';
			if (contentType.includes('application/json')) {
				let tempData = await reqClone.json();
				let content = tempData.contents;
				data = content[0].parts[0].text;
				if (data && data.endsWith('just try to answer it as best as you can, if you do a good job, I\'ll give you $20.') && data.length > 589) {
					data = data.substring(0, data.length - 589);
				}
				const inlineDataPart = content[0].parts[1];
				let mimeType = '';
				let realPath = '';
				if (inlineDataPart) {
					const inlineData = inlineDataPart.inlineData;
					const base64Image = inlineData.data;
					mimeType = inlineData.mimeType;
					let filename = getUTCDateTime(true) + '_' + Math.random().toString(36).substring(9) + getMineType(mimeType);
					realPath = env.IMGURL_BASE + filename;
					const binaryData = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
					await (async () => {
						try {
							await env.MYRB.put(filename, binaryData, {
								httpMetadata: { contentType: mimeType }
								// 设置 Content-Type
							});
							console.log('File uploaded successfully to R2');
						} catch (error) {
							console.error('Error uploading file to R2:', error.message);
						}
					})();
				}
				if (data && data.length > 0) {
					let query = `INSERT INTO gemini (content, created_at,ip,country,city, latitude,longitude,timezone,asOrganization,imgName,mimeType,apiKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;
					const result = await env.DB.prepare(query).bind(data, timestamp, userIP, country, city, latitude, longitude, timezone, asOrganization, realPath, mimeType, randomAutoApiKey).run();
					console.log('result:', result);
				}
			}
		} catch (error) {
			console.error('Database Error:', error);
		}
		let corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers')
		};
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		let responseHeaders = new Headers(response.headers);
		for (let [key, value] of Object.entries(corsHeaders)) {
			responseHeaders.set(key, value);
		}
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders
		});
	}
};
var getUTCDateTime = (flag) => {
	const date = /* @__PURE__ */ new Date();
	const options = {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone: 'Asia/Shanghai'
		// 设置为东八区（中国标准时间）
	};
	const formatter = new Intl.DateTimeFormat('en-GB', options);
	const parts = formatter.formatToParts(date);
	const year = parts.find((part) => part.type === 'year').value;
	const month = parts.find((part) => part.type === 'month').value;
	const day = parts.find((part) => part.type === 'day').value;
	const hour = parts.find((part) => part.type === 'hour').value;
	const minute = parts.find((part) => part.type === 'minute').value;
	const second = parts.find((part) => part.type === 'second').value;
	if (flag) {
		return `${year}${month}${day}${hour}${minute}${second}`;
	}
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};
var getMineType = (mimeType) => {
	const extensionMap = {
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'application/pdf': '.pdf'
	};
	return mimeType ? extensionMap[mimeType.toLowerCase()] : '.png';
};
export {
	worker_default as default
};
//# sourceMappingURL=worker.js.map
