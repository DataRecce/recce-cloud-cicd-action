/**
 * Type definitions for Recce Cloud CI/CD Action
 */

/**
 * Action inputs from action.yml
 */
export interface ActionInputs {
  dbt_target_path: string;
  api_host: string;
  web_host: string;
  github_token: string;
  base_branch: string;
}

/**
 * DBT Manifest metadata structure
 */
export interface DbtManifestMetadata {
  adapter_type: string;
  dbt_version: string;
  [key: string]: unknown;
}

/**
 * DBT Manifest JSON structure
 */
export interface DbtManifest {
  metadata: DbtManifestMetadata;
  nodes?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Request body for creating/touching a Recce session
 */
export interface TouchSessionRequest {
  branch: string;
  pr_number?: number;
  adapter_type: string;
}

/**
 * Response from Recce Cloud touch-recce-session API
 */
export interface TouchSessionResponse {
  session_id: string;
  manifest_upload_url: string;
  catalog_upload_url: string;
}

/**
 * Request body for upload completion notification
 */
export interface UploadCompletedRequest {
  session_id: string;
}

/**
 * GitHub context type for pull request events
 */
export interface PullRequestContext {
  pull_request: {
    number: number;
    head: {
      ref: string;
    };
  };
}

/**
 * Type of session being created
 */
export type SessionType = 'pr' | 'base';

/**
 * HTTP response type with status code and result
 */
export interface HttpResponse<T> {
  statusCode: number;
  result: T | null;
}

/**
 * Error context for better error reporting
 */
export interface ErrorContext {
  repository: string;
  branch: string;
  eventType: string;
  apiEndpoint?: string;
}
