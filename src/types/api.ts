// ── Bucket ──────────────────────────────────────────────────────────────────
/** Mirrors Go `metadata.Bucket` */
export interface Bucket {
	name: string;
	ownerId: string;
	createdAt: string; // ISO 8601
	objectCount?: number;
	totalObjectBytes?: number;
}

// ── Object ──────────────────────────────────────────────────────────────────
/** Mirrors Go `metadata.Object` (excludes storage_path — internal only) */
export interface StorageObject {
	id: string;
	bucketName: string;
	key: string;
	size: number;
	etag: string;
	contentType: string;
	createdAt: string;
	updatedAt: string;
}

/** Paginated object listing result, mirrors ListObjectsV2 semantics */
export interface ObjectListing {
	objects: StorageObject[];
	isTruncated: boolean;
	nextStartAfter: string | null;
	commonPrefixes: string[];
}

// ── Access Key ──────────────────────────────────────────────────────────────
/** Mirrors Go `metadata.User` (sans secret_hash — never exposed) */
export interface AccessKey {
	id: string;
	displayName: string;
	accessKeyId: string;
	sigV4AccessKeyId: string;
	role: 'admin' | 'member';
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Response when creating a new key — secret shown once */
export interface CreateKeyResponse {
	key: AccessKey;
	bearerToken: string;
	sigV4: {
		accessKeyId: string;
		secretKey: string;
	};
}

export interface CreateKeyRequest {
	displayName: string;
	role: 'admin' | 'member';
}

export interface UpdateKeyRequest {
	displayName?: string;
	isActive?: boolean;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardMetrics {
	totalBuckets: number;
	totalObjects: number;
	totalStorageBytes: number;
	totalKeys: number;
	activeKeys: number;
	recentUploads: StorageObject[];
}

// ── Server ──────────────────────────────────────────────────────────────────
export interface ServerConfig {
	region: string;
	devMode: boolean;
	publicBaseUrl: string;
	limits: ServerLimits;
}

export interface ServerLimits {
	s3MaxKeys: number;
	s3DeleteObjects: number;
	managementObjectListLimit: number;
	managementActivityLimit: number;
}

// ── Activity ────────────────────────────────────────────────────────────────
export type ActivityAction =
	| 'put_object'
	| 'delete_object'
	| 'delete_objects'
	| 'copy_object'
	| 'create_bucket'
	| 'delete_bucket'
	| 'force_delete_bucket'
	| 'empty_bucket'
	| string;

export interface ActivityItem {
	id: string;
	action: ActivityAction;
	bucket: string;
	key?: string;
	size?: number;
	etag?: string;
	actorUserId?: string;
	createdAt: string;
}

export interface ListActivityOptions {
	bucket?: string;
	action?: string;
	limit?: number;
}

// ── S3 Compatibility ────────────────────────────────────────────────────────
export interface S3Owner {
	id: string;
	displayName: string;
}

export interface S3Bucket {
	name: string;
	createdAt: string;
}

export interface S3BucketList {
	owner: S3Owner;
	buckets: S3Bucket[];
}

export interface HeadBucketResult {
	exists: boolean;
	status: number;
}

export interface BucketLocation {
	bucket: string;
	region: string;
}

export interface ListObjectsV1Options {
	prefix?: string;
	marker?: string;
	maxKeys?: number;
	delimiter?: string;
	encodingType?: 'url';
}

export interface ObjectListingV1 {
	objects: StorageObject[];
	commonPrefixes: string[];
	isTruncated: boolean;
	nextMarker: string | null;
}

export interface CopyObjectRequest {
	sourceBucket: string;
	sourceKey: string;
	destinationBucket: string;
	destinationKey: string;
	metadataDirective?: 'COPY' | 'REPLACE';
	contentType?: string;
}

export interface CopyObjectResult {
	etag: string;
	lastModified: string;
}

export interface DeleteObjectsResult {
	deleted: string[];
}

// ── API Client Interface ────────────────────────────────────────────────────
export interface ListObjectsOptions {
	prefix?: string;
	startAfter?: string;
	maxKeys?: number;
	delimiter?: string;
}

export interface FbsClient {
	healthCheck(): Promise<boolean>;
	// Server
	getConfig(): Promise<ServerConfig>;
	listActivity(opts?: ListActivityOptions): Promise<ActivityItem[]>;
	// Buckets
	listBuckets(): Promise<Bucket[]>;
	getBucket(name: string): Promise<Bucket>;
	createBucket(name: string): Promise<Bucket>;
	deleteBucket(name: string): Promise<void>;
	emptyBucket(name: string): Promise<void>;
	// Objects
	listObjects(bucket: string, opts?: ListObjectsOptions): Promise<ObjectListing>;
	deleteObject(bucket: string, key: string): Promise<void>;
	// Keys
	listKeys(): Promise<AccessKey[]>;
	createKey(data: CreateKeyRequest): Promise<CreateKeyResponse>;
	updateKey(id: string, data: UpdateKeyRequest): Promise<AccessKey>;
	deleteKey(id: string): Promise<void>;
	// Metrics
	getMetrics(): Promise<DashboardMetrics>;
	// S3 compatibility
	listBucketsS3(): Promise<S3BucketList>;
	headBucketS3(name: string): Promise<HeadBucketResult>;
	deleteEmptyBucketS3(name: string): Promise<void>;
	getBucketLocation(name: string): Promise<BucketLocation>;
	listObjectsV1(bucket: string, opts?: ListObjectsV1Options): Promise<ObjectListingV1>;
	copyObject(data: CopyObjectRequest): Promise<CopyObjectResult>;
	deleteObjects(bucket: string, keys: string[], quiet?: boolean): Promise<DeleteObjectsResult>;
}
