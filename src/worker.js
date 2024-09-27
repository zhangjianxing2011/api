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

		if (env.ORIGIN_URL != reqClone.headers.get('origin')) {
			return new Response({}, {
				status: 200,
				statusText: "",
				headers: {}
			});
		}


		let randomAutoApiKey;
		if (apiKey === env.OBFUSCATED_VALUES) {
			const randomApiKey = apiKeyOptions[Math.floor(Math.random() * apiKeyOptions.length)];
			randomAutoApiKey = randomApiKey;
			headers.set('x-goog-api-key', randomApiKey);
			headers.set('Accept-Language', 'zh-CN');
			headers.set('Content-Type', 'application/json; charset=utf-8');
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
		let uuid = generateUUID();
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
				console.log(data);
				if (data && data.endsWith('just try to answer it as best as you can, if you do a good job, I\'ll give you $20.') && data.length > 589) {
					data = data.substring(0, data.length - 589);
					while (data.endsWith('-')) {
						data = data.substring(0, data.length - 1);
					}
				}
				const inlineDataPart = content[0].parts[1];
				let mimeType = '';
				let realPath = '';
				if (inlineDataPart) {
					const inlineData = inlineDataPart.inlineData;
					const base64Image = inlineData.data;
					mimeType = inlineData.mimeType;
					let filename = getUTCDateTime(true) + '_' + Math.random().toString(36).substring(2) + getMineType(mimeType);
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
					let query = `INSERT INTO gemini (content, created_at,ip,country,city, latitude,longitude,timezone,asOrganization,imgName,mimeType,apiKey,uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
					const result = await env.DB.prepare(query).bind(data, timestamp, userIP, country, city, latitude, longitude, timezone, asOrganization, realPath, mimeType, randomAutoApiKey, uuid).run();
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

		// 获取可读流
		let tempResp = response.clone();
		try{
			const reader = tempResp.body.getReader();
			const decoder = new TextDecoder('utf-8');
			let buffer = "";
			let pjStr = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const byt = new Uint8Array(value);
				const str = decoder.decode(byt);
				pjStr += str;
			}
			pjStr = pjStr.replace(',\\"safetyRatings\\": [{\\"category\\": \\"HARM_CATEGORY_SEXUALLY_EXPLICIT\\",\\"probability\\": \\"NEGLIGIBLE\\"},{\\"category\\": \\"HARM_CATEGORY_HATE_SPEECH\\",\\"probability\\": \\"NEGLIGIBLE\\"},{\\"category\\": \\"HARM_CATEGORY_HARASSMENT\\",\\"probability\\": \\"NEGLIGIBLE\\"},{\\"category\\": \\"HARM_CATEGORY_DANGEROUS_CONTENT\\",\\"probability\\": \\"NEGLIGIBLE\\"}]', '');
			const result = parseStr(pjStr);
			console.log('finalResult:', result);
			const resultStr = result.join('');

			let updateSql = `UPDATE gemini SET result=? WHERE uuid = ?`
			const updateResult = await env.DB.prepare(updateSql).bind(resultStr, uuid).run();
		}catch (error){
			console.error('Error reading response body:', error);
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
		'image/webp': '.webp',
		'application/pdf': '.pdf'
	};
	return mimeType ? extensionMap[mimeType.toLowerCase()] ? extensionMap[mimeType.toLowerCase()] : '.' + mimeType.toLowerCase().split('/')[1] : '.png';
};

const generateUUID = () => { // Public Domain/MIT
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 32 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(32);
	});
};

const parseStr = (data) => {
	const textData = [];
	const regex = /data: (.+)/g;
	let match;

	while ((match = regex.exec(data)) !== null) {
		try {
			const jsonObj = JSON.parse(match[1]);
			const text = jsonObj.candidates[0].content.parts[0].text;
			textData.push(text);
		} catch (e) {
			console.error('Invalid JSON:', e);
		}
	}

	return textData;
};

export {
	worker_default as default
};
//# sourceMappingURL=worker.js.map
