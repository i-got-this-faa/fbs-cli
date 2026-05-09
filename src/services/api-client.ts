import type {
	ActivityItem,
	Bucket,
	CreateKeyRequest,
	CreateKeyResponse,
	DashboardMetrics,
	DeleteObjectsResult,
	FbsClient,
	HeadBucketResult,
	ListActivityOptions,
	ListObjectsOptions,
	ListObjectsV1Options,
	ObjectListing,
	ObjectListingV1,
	ServerConfig,
	AccessKey,
	UpdateKeyRequest,
	S3BucketList,
	BucketLocation,
	CopyObjectRequest,
	CopyObjectResult,
	StorageObject,
} from '../types/api';

interface ManagementConfigResponse {
	region: string;
	dev_mode: boolean;
	public_base_url: string;
	limits: {
		s3_max_keys: number;
		s3_delete_objects: number;
		management_object_list_limit: number;
		management_activity_limit: number;
	};
}

interface ManagementActivityResponse {
	activity: ManagementActivityItem[];
}

interface ManagementActivityItem {
	id: string;
	action: string;
	bucket: string;
	key?: string;
	size?: number;
	etag?: string;
	actor_user_id?: string;
	created_at: string;
}

interface ManagementBucketResponse {
	name: string;
	owner_id: string;
	created_at: string;
	object_count?: number;
	total_object_bytes?: number;
}

interface ManagementBucketsResponse {
	buckets: ManagementBucketResponse[];
}

interface ManagementBucketSummaryResponse {
	bucket: ManagementBucketResponse;
}

interface ManagementObjectResponse {
	id: string;
	bucket_name: string;
	key: string;
	size: number;
	etag: string;
	content_type: string;
	created_at: string;
	updated_at: string;
}

interface ManagementObjectsResponse {
	bucket: string;
	is_truncated: boolean;
	next_cursor: string | null;
	objects: ManagementObjectResponse[];
	common_prefixes: string[];
}

interface ManagementKeyResponse {
	id: string;
	display_name: string;
	access_key_id: string;
	sigv4_access_key_id: string;
	role: 'admin' | 'member';
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

interface ManagementKeysResponse {
	keys: ManagementKeyResponse[];
}

interface ManagementCreateKeyResponse {
	key: ManagementKeyResponse;
	bearer_token: string;
	sigv4: {
		access_key_id: string;
		secret_key: string;
	};
}

interface ManagementUpdateKeyResponse {
	key: ManagementKeyResponse;
}

interface ManagementMetricsResponse {
	bucket_count: number;
	object_count: number;
	total_object_bytes: number;
	user_count: number;
	active_user_count: number;
}

interface ManagementErrorResponse {
	error?: { message?: string };
}

function mapConfig(data: ManagementConfigResponse): ServerConfig {
	return {
		region: data.region,
		devMode: data.dev_mode,
		publicBaseUrl: data.public_base_url,
		limits: {
			s3MaxKeys: data.limits.s3_max_keys,
			s3DeleteObjects: data.limits.s3_delete_objects,
			managementObjectListLimit: data.limits.management_object_list_limit,
			managementActivityLimit: data.limits.management_activity_limit,
		},
	};
}

function mapActivity(data: ManagementActivityItem): ActivityItem {
	return {
		id: data.id,
		action: data.action,
		bucket: data.bucket,
		key: data.key,
		size: data.size,
		etag: data.etag,
		actorUserId: data.actor_user_id,
		createdAt: data.created_at,
	};
}

function mapBucket(data: ManagementBucketResponse): Bucket {
	return {
		name: data.name,
		ownerId: data.owner_id,
		createdAt: data.created_at,
		objectCount: data.object_count,
		totalObjectBytes: data.total_object_bytes,
	};
}

function mapObject(data: ManagementObjectResponse) {
	return {
		id: data.id,
		bucketName: data.bucket_name,
		key: data.key,
		size: data.size,
		etag: data.etag,
		contentType: data.content_type,
		createdAt: data.created_at,
		updatedAt: data.updated_at,
	};
}

function mapKey(data: ManagementKeyResponse): AccessKey {
	return {
		id: data.id,
		displayName: data.display_name,
		accessKeyId: data.access_key_id,
		sigV4AccessKeyId: data.sigv4_access_key_id,
		role: data.role,
		isActive: data.is_active,
		createdAt: data.created_at,
		updatedAt: data.updated_at,
	};
}

async function readManagementErrorMessage(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as ManagementErrorResponse;
		return body.error?.message ?? `HTTP ${res.status}`;
	} catch {
		return `HTTP ${res.status}`;
	}
}

function encodeObjectKeyPath(key: string): string {
	return key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
}

function encodeBucketName(name: string): string {
	return encodeURIComponent(name);
}

export class FbsApiClient implements FbsClient {
	private readonly _baseUrl: string;
	private readonly _token: string;

	constructor(baseUrl: string, token: string) {
		this._baseUrl = baseUrl;
		this._token = token;
	}

	private get _authHeaders(): Record<string, string> {
		return {
			Authorization: `Bearer ${this._token}`,
		};
	}

	private async _managementFetch(path: string, init?: RequestInit): Promise<Response> {
		const url = `${this._baseUrl}/api/management${path}`;
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...this._authHeaders,
		};
		if (init?.body) {
			headers['Content-Type'] = 'application/json';
		}
		return fetch(url, { ...init, headers });
	}

	private async _s3Fetch(path: string, init?: RequestInit): Promise<Response> {
		const url = `${this._baseUrl}${path}`;
		return fetch(url, { ...init, headers: this._authHeaders });
	}

	async healthCheck(): Promise<boolean> {
		try {
			const res = await fetch(`${this._baseUrl}/healthz`);
			return res.ok;
		} catch {
			return false;
		}
	}

	// ── Server ──────────────────────────────────────────────────────────────

	async getConfig(): Promise<ServerConfig> {
		const res = await this._managementFetch('/config');
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementConfigResponse;
		return mapConfig(data);
	}

	async listActivity(opts?: ListActivityOptions): Promise<ActivityItem[]> {
		const params = new URLSearchParams();
		if (opts?.bucket) params.set('bucket', opts.bucket);
		if (opts?.action) params.set('action', opts.action);
		if (opts?.limit) params.set('limit', String(opts.limit));
		const res = await this._managementFetch(`/activity?${params.toString()}`);
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementActivityResponse;
		return data.activity.map(mapActivity);
	}

	// ── Buckets ─────────────────────────────────────────────────────────────

	async listBuckets(): Promise<Bucket[]> {
		const res = await this._managementFetch('/buckets');
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementBucketsResponse;
		return data.buckets.map(mapBucket);
	}

	async getBucket(name: string): Promise<Bucket> {
		const res = await this._managementFetch(`/buckets/${encodeBucketName(name)}`);
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementBucketSummaryResponse;
		return mapBucket(data.bucket);
	}

	async createBucket(name: string): Promise<Bucket> {
		const res = await this._s3Fetch(`/${encodeBucketName(name)}`, { method: 'PUT' });
		if (!res.ok) throw new Error(`Failed to create bucket: ${res.status}`);
		return { name, ownerId: '', createdAt: new Date().toISOString() };
	}

	async deleteBucket(name: string): Promise<void> {
		const res = await this._managementFetch(`/buckets/${encodeBucketName(name)}`, { method: 'DELETE' });
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
	}

	async emptyBucket(name: string): Promise<void> {
		const res = await this._managementFetch(`/buckets/${encodeBucketName(name)}/empty`, { method: 'POST' });
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
	}

	// ── Objects ─────────────────────────────────────────────────────────────

	async listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing> {
		const params = new URLSearchParams();
		if (opts?.prefix) params.set('prefix', opts.prefix);
		if (opts?.startAfter) params.set('cursor', opts.startAfter);
		if (opts?.maxKeys) params.set('limit', String(opts.maxKeys));
		if (opts?.delimiter) params.set('delimiter', opts.delimiter);
		const res = await this._managementFetch(`/buckets/${encodeBucketName(bucket)}/objects?${params.toString()}`);
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementObjectsResponse;
		return {
			objects: data.objects.map(mapObject),
			isTruncated: data.is_truncated,
			nextStartAfter: data.next_cursor,
			commonPrefixes: data.common_prefixes,
		};
	}

	async deleteObject(bucket: string, key: string): Promise<void> {
		const res = await this._s3Fetch(`/${encodeBucketName(bucket)}/${encodeObjectKeyPath(key)}`, { method: 'DELETE' });
		if (!res.ok) throw new Error(`Failed to delete object: ${res.status}`);
	}

	// ── Keys ────────────────────────────────────────────────────────────────

	async listKeys(): Promise<AccessKey[]> {
		const res = await this._managementFetch('/keys');
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementKeysResponse;
		return data.keys.map(mapKey);
	}

	async createKey(data: CreateKeyRequest): Promise<CreateKeyResponse> {
		const res = await this._managementFetch('/keys', {
			method: 'POST',
			body: JSON.stringify({ display_name: data.displayName, role: data.role }),
		});
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const body = (await res.json()) as ManagementCreateKeyResponse;
		return {
			key: mapKey(body.key),
			bearerToken: body.bearer_token,
			sigV4: {
				accessKeyId: body.sigv4.access_key_id,
				secretKey: body.sigv4.secret_key,
			},
		};
	}

	async updateKey(id: string, data: UpdateKeyRequest): Promise<AccessKey> {
		const body: Record<string, unknown> = {};
		if (data.displayName !== undefined) body.display_name = data.displayName;
		if (data.isActive !== undefined) body.is_active = data.isActive;
		const res = await this._managementFetch(`/keys/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const response = (await res.json()) as ManagementUpdateKeyResponse;
		return mapKey(response.key);
	}

	async deleteKey(id: string): Promise<void> {
		const res = await this._managementFetch(`/keys/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
	}

	// ── Metrics ─────────────────────────────────────────────────────────────

	async getMetrics(): Promise<DashboardMetrics> {
		const res = await this._managementFetch('/metrics');
		if (!res.ok) throw new Error(await readManagementErrorMessage(res));
		const data = (await res.json()) as ManagementMetricsResponse;
		return {
			totalBuckets: data.bucket_count,
			totalObjects: data.object_count,
			totalStorageBytes: data.total_object_bytes,
			totalKeys: data.user_count,
			activeKeys: data.active_user_count,
			recentUploads: [],
		};
	}

	// ── S3 Compatibility ────────────────────────────────────────────────────

	async listBucketsS3(): Promise<S3BucketList> {
		const res = await this._s3Fetch('/');
		if (!res.ok) throw new Error(`S3 list buckets failed: ${res.status}`);
		const xml = await res.text();
		return parseS3ListBuckets(xml);
	}

	async headBucketS3(name: string): Promise<HeadBucketResult> {
		try {
			const res = await this._s3Fetch(`/${encodeBucketName(name)}?list-type=2&max-keys=0`);
			return { exists: res.ok, status: res.status };
		} catch {
			return { exists: false, status: 0 };
		}
	}

	async deleteEmptyBucketS3(name: string): Promise<void> {
		const res = await this._s3Fetch(`/${encodeBucketName(name)}`, { method: 'DELETE' });
		if (!res.ok) throw new Error(`S3 delete bucket failed: ${res.status}`);
	}

	async getBucketLocation(name: string): Promise<BucketLocation> {
		const res = await this._s3Fetch(`/${encodeBucketName(name)}?location`);
		if (!res.ok) throw new Error(`S3 get bucket location failed: ${res.status}`);
		const xml = await res.text();
		return parseS3BucketLocation(xml, name);
	}

	async listObjectsV1(bucket: string, opts?: ListObjectsV1Options): Promise<ObjectListingV1> {
		const params = new URLSearchParams();
		params.set('list-type', '1');
		if (opts?.prefix) params.set('prefix', opts.prefix);
		if (opts?.marker) params.set('marker', opts.marker);
		if (opts?.maxKeys) params.set('max-keys', String(opts.maxKeys));
		if (opts?.delimiter) params.set('delimiter', opts.delimiter);
		if (opts?.encodingType) params.set('encoding-type', opts.encodingType);
		const res = await this._s3Fetch(`/${encodeBucketName(bucket)}?${params.toString()}`);
		if (!res.ok) throw new Error(`S3 list objects failed: ${res.status}`);
		const xml = await res.text();
		return parseS3ListObjectsV1(xml);
	}

	async copyObject(data: CopyObjectRequest): Promise<CopyObjectResult> {
		const source = `/${encodeBucketName(data.sourceBucket)}/${encodeObjectKeyPath(data.sourceKey)}`;
		const headers: Record<string, string> = {
			'x-amz-copy-source': source,
		};
		if (data.metadataDirective) headers['x-amz-metadata-directive'] = data.metadataDirective;
		if (data.contentType) headers['Content-Type'] = data.contentType;
		const res = await this._s3Fetch(
			`/${encodeBucketName(data.destinationBucket)}/${encodeObjectKeyPath(data.destinationKey)}`,
			{
				method: 'PUT',
				headers,
			},
		);
		if (!res.ok) throw new Error(`S3 copy object failed: ${res.status}`);
		const xml = await res.text();
		return parseS3CopyObjectResult(xml);
	}

	async deleteObjects(bucket: string, keys: string[], quiet?: boolean): Promise<DeleteObjectsResult> {
		const keyXml = keys.map((k) => `<Key>${xmlEscape(k)}</Key>`).join('');
		const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>${quiet ?? false}</Quiet>${keyXml}</Delete>`;
		const res = await this._s3Fetch(`/${encodeBucketName(bucket)}?delete`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/xml' },
			body,
		});
		if (!res.ok) throw new Error(`S3 delete objects failed: ${res.status}`);
		const xml = await res.text();
		return parseS3DeleteObjectsResult(xml);
	}
}

// ── S3 XML Parsing ──────────────────────────────────────────────────────────

function getXmlText(xml: string, tag: string): string | null {
	const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
	return match?.[1] ?? null;
}

function getXmlTextOrDefault(xml: string, tag: string, defaultValue: string): string {
	return getXmlText(xml, tag) ?? defaultValue;
}

function xmlEscape(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseS3ListBuckets(xml: string): S3BucketList {
	const ownerId = getXmlTextOrDefault(xml, 'ID', '');
	const displayName = getXmlTextOrDefault(xml, 'DisplayName', '');
	const buckets: { name: string; createdAt: string }[] = [];
	const bucketMatches = xml.matchAll(/<Bucket>([\s\S]*?)<\/Bucket>/g);
	for (const match of bucketMatches) {
		const bucketXml = match[1];
		if (!bucketXml) continue;
		const name = getXmlText(bucketXml, 'Name');
		const createdAt = getXmlText(bucketXml, 'CreationDate');
		if (name) {
			buckets.push({ name, createdAt: createdAt ?? '' });
		}
	}
	return {
		owner: { id: ownerId, displayName },
		buckets,
	};
}

function parseS3BucketLocation(xml: string, bucket: string): BucketLocation {
	const region = getXmlTextOrDefault(xml, 'LocationConstraint', 'us-east-1');
	return { bucket, region };
}

function parseS3ListObjectsV1(xml: string): ObjectListingV1 {
	const objects: StorageObject[] = [];
	const objectMatches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
	for (const match of objectMatches) {
		const objXml = match[1];
		if (!objXml) continue;
		const key = getXmlText(objXml, 'Key');
		if (!key) continue;
		const sizeStr = getXmlText(objXml, 'Size');
		const size = sizeStr ? Number(sizeStr) : 0;
		const etag = getXmlTextOrDefault(objXml, 'ETag', '');
		const lastModified = getXmlTextOrDefault(objXml, 'LastModified', '');
		objects.push({
			id: '',
			bucketName: '',
			key,
			size,
			etag,
			contentType: 'application/octet-stream',
			createdAt: lastModified,
			updatedAt: lastModified,
		});
	}

	const commonPrefixes: string[] = [];
	const prefixMatches = xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g);
	for (const match of prefixMatches) {
		const prefixXml = match[1];
		if (!prefixXml) continue;
		const prefix = getXmlText(prefixXml, 'Prefix');
		if (prefix) commonPrefixes.push(prefix);
	}

	const isTruncated = getXmlText(xml, 'IsTruncated') === 'true';
	const nextMarker = getXmlText(xml, 'NextMarker');

	return { objects, commonPrefixes, isTruncated, nextMarker };
}

function parseS3CopyObjectResult(xml: string): CopyObjectResult {
	return {
		etag: getXmlTextOrDefault(xml, 'ETag', ''),
		lastModified: getXmlTextOrDefault(xml, 'LastModified', ''),
	};
}

function parseS3DeleteObjectsResult(xml: string): DeleteObjectsResult {
	const deleted: string[] = [];
	const deletedMatches = xml.matchAll(/<Deleted>([\s\S]*?)<\/Deleted>/g);
	for (const match of deletedMatches) {
		const deletedXml = match[1];
		if (!deletedXml) continue;
		const key = getXmlText(deletedXml, 'Key');
		if (key) deleted.push(key);
	}
	return { deleted };
}
