import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';
import * as path from 'path';
import { HttpClient } from '@actions/http-client';
import type {
  ActionInputs,
  DbtManifest,
  TouchSessionRequest,
  TouchSessionResponse,
  UploadCompletedRequest,
  PullRequestContext,
  SessionType,
  ErrorContext
} from './types';

/**
 * Verify that required DBT manifest files exist
 * @param dbtTargetPath - Path to the DBT target directory
 * @throws Error if manifest files are missing
 */
async function verifyDbtManifestFiles(dbtTargetPath: string): Promise<void> {
  core.info(`[Verify] DBT manifest files in '${dbtTargetPath}' directory...`);

  const manifestPath = path.join(dbtTargetPath, 'manifest.json');
  const catalogPath = path.join(dbtTargetPath, 'catalog.json');

  try {
    await fs.access(manifestPath);
  } catch (error) {
    const errorMsg = `[Error] DBT manifest.json file not found in ${dbtTargetPath} directory.`;
    core.error(errorMsg);
    await core.summary
      .addHeading('Recce Cloud CI/CD Action Error', 3)
      .addRaw(
        'The DBT `manifest.json` file is missing. Please ensure that your DBT project has been built and the manifest.json file is present in the specified target directory.'
      )
      .write();
    throw new Error(errorMsg);
  }

  try {
    await fs.access(catalogPath);
  } catch (error) {
    const errorMsg = `[Error] DBT catalog.json file not found in ${dbtTargetPath} directory.`;
    core.error(errorMsg);
    await core.summary
      .addHeading('Recce Cloud CI/CD Action Error', 3)
      .addRaw(
        'The DBT `catalog.json` file is missing. Please ensure that your DBT project has been built and the catalog.json file is present in the specified target directory.'
      )
      .write();
    throw new Error(errorMsg);
  }

  core.info('[Done] DBT manifest files verified.');
}

/**
 * Get the adapter type from manifest.json
 * @param dbtTargetPath - Path to the DBT target directory
 * @returns The adapter type (e.g., 'postgres', 'snowflake', 'bigquery')
 * @throws Error if manifest.json is invalid or missing adapter_type
 */
async function getAdapterType(dbtTargetPath: string): Promise<string> {
  const manifestPath = path.join(dbtTargetPath, 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf8');

  try {
    const manifest = JSON.parse(manifestContent) as DbtManifest;

    if (!manifest.metadata?.adapter_type) {
      throw new Error('adapter_type not found in manifest metadata');
    }

    return manifest.metadata.adapter_type;
  } catch (error) {
    const errorMsg = `Failed to parse manifest.json or extract adapter_type: ${error instanceof Error ? error.message : String(error)}`;
    core.error(errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Upload file to a presigned URL
 * @param httpClient - HTTP client instance
 * @param filePath - Path to the file to upload
 * @param uploadUrl - Presigned URL for upload
 * @throws Error if upload fails
 */
async function uploadFile(
  httpClient: HttpClient,
  filePath: string,
  uploadUrl: string
): Promise<void> {
  const fileContent = await fs.readFile(filePath, 'utf8');

  const response = await httpClient.put(uploadUrl, fileContent, {
    'Content-Type': 'application/json'
  });

  if (response.message.statusCode !== 200) {
    throw new Error(`Failed to upload file: ${filePath}. Status: ${response.message.statusCode}`);
  }
}

/**
 * Build error context for better error reporting
 * @param repository - Repository name
 * @param branch - Branch name
 * @param eventType - GitHub event type
 * @param apiEndpoint - Optional API endpoint
 * @returns Error context object
 */
function buildErrorContext(
  repository: string,
  branch: string,
  eventType: string,
  apiEndpoint?: string
): ErrorContext {
  return {
    repository,
    branch,
    eventType,
    apiEndpoint
  };
}

/**
 * Log detailed error with context
 * @param message - Error message
 * @param context - Error context
 * @param error - Original error object
 */
async function logDetailedError(
  message: string,
  context: ErrorContext,
  error?: unknown
): Promise<void> {
  core.error(message);
  core.error(`Context: ${JSON.stringify(context, null, 2)}`);

  if (error instanceof Error) {
    core.error(`Error details: ${error.message}`);
    if (error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }
  }

  await core.summary
    .addHeading('Recce Cloud CI/CD Action Error', 3)
    .addRaw(message)
    .addHeading('Context', 4)
    .addCodeBlock(JSON.stringify(context, null, 2), 'json')
    .write();
}

/**
 * Create or touch a Recce session and upload DBT artifacts
 * @param inputs - Action inputs
 * @returns Session ID for pull requests, undefined for base branch
 */
async function uploadDbtArtifacts(inputs: ActionInputs): Promise<string | undefined> {
  const httpClient = new HttpClient('recce-cloud-cicd-action', undefined, {
    allowRetries: true,
    maxRetries: 3
  });

  const context = github.context;
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const adapterType = await getAdapterType(inputs.dbt_target_path);

  let requestBody: TouchSessionRequest;
  let sessionType: SessionType;
  let branchName: string;

  if (context.eventName === 'pull_request') {
    core.info('[Upload] Artifacts for Pull Request session...');

    const payload = context.payload as PullRequestContext;
    branchName = payload.pull_request.head.ref;
    const prNumber = payload.pull_request.number;

    requestBody = {
      branch: branchName,
      pr_number: prNumber,
      adapter_type: adapterType
    };
    sessionType = 'pr';
  } else {
    core.info('[Upload] Artifacts for base session...');

    branchName = context.ref.replace('refs/heads/', '');

    requestBody = {
      branch: branchName,
      adapter_type: adapterType
    };
    sessionType = 'base';
  }

  // Create or touch Recce session
  const touchUrl = `${inputs.api_host}/api/v2/github/${repository}/touch-recce-session`;
  const errorContext = buildErrorContext(repository, branchName, context.eventName, touchUrl);

  let response;
  try {
    response = await httpClient.postJson<TouchSessionResponse>(touchUrl, requestBody, {
      Authorization: `Bearer ${inputs.github_token}`,
      'Content-Type': 'application/json'
    });
  } catch (error) {
    await logDetailedError('Failed to create or retrieve Recce session', errorContext, error);
    throw error;
  }

  if (response.statusCode !== 200 || !response.result) {
    const errorMsg = `Failed to create or retrieve Recce session. HTTP Status: ${response.statusCode}`;
    await logDetailedError(errorMsg, errorContext);
    throw new Error(errorMsg);
  }

  const responseData = response.result;
  const { manifest_upload_url, catalog_upload_url, session_id } = responseData;

  core.info(`Manifest Upload URL: ${manifest_upload_url}`);
  core.info(`Catalog Upload URL: ${catalog_upload_url}`);

  if (!manifest_upload_url || !catalog_upload_url || !session_id) {
    const errorMsg = 'Failed to get upload URLs or session ID from Recce Cloud.';
    await logDetailedError(errorMsg, errorContext);
    throw new Error(errorMsg);
  }

  // Upload manifest.json and catalog.json
  core.info('[Uploading] manifest.json and catalog.json to Recce Cloud...');
  const manifestPath = path.join(inputs.dbt_target_path, 'manifest.json');
  const catalogPath = path.join(inputs.dbt_target_path, 'catalog.json');

  try {
    await Promise.all([
      uploadFile(httpClient, manifestPath, manifest_upload_url),
      uploadFile(httpClient, catalogPath, catalog_upload_url)
    ]);
  } catch (error) {
    await logDetailedError('Failed to upload artifacts', errorContext, error);
    throw error;
  }

  core.info('[Done] Artifacts uploaded to Recce Cloud.');

  // Notify upload completion
  const uploadCompletedUrl = `${inputs.api_host}/api/v2/github/${repository}/upload-completed`;
  const uploadCompletedBody: UploadCompletedRequest = { session_id };

  await httpClient.postJson(uploadCompletedUrl, uploadCompletedBody, {
    Authorization: `Bearer ${inputs.github_token}`,
    'Content-Type': 'application/json'
  });

  // Add summary
  if (sessionType === 'pr') {
    await core.summary
      .addHeading('Recce Cloud CI/CD Action Info', 3)
      .addRaw('Please use the link below to launch your Recce Cloud session.')
      .addLink('Launch Recce Cloud Session', `${inputs.web_host}/launch/${session_id}`)
      .write();

    core.setOutput('session_id', session_id);
    return session_id;
  } else {
    await core.summary
      .addHeading('Recce Cloud CI/CD Action Info', 3)
      .addRaw('The base session has been updated.')
      .write();

    return undefined;
  }
}

/**
 * Get and validate action inputs
 * @returns Validated action inputs
 * @throws Error if required inputs are missing
 */
function getInputs(): ActionInputs {
  const dbtTargetPath = core.getInput('dbt_target_path', { required: true });
  const apiHost = core.getInput('api_host') || 'https://cloud.datarecce.io';
  const webHost = core.getInput('web_host') || 'https://cloud.datarecce.io';
  const baseBranch = core.getInput('base_branch') || 'main';
  const githubToken = process.env.GITHUB_TOKEN || core.getInput('github_token');

  if (!githubToken) {
    throw new Error(
      'GITHUB_TOKEN is required. Please set it in your workflow or pass it as an input.'
    );
  }

  return {
    dbt_target_path: dbtTargetPath,
    api_host: apiHost,
    web_host: webHost,
    base_branch: baseBranch,
    github_token: githubToken
  };
}

/**
 * Main action entry point
 */
export async function run(): Promise<void> {
  try {
    // Get and validate inputs
    const inputs = getInputs();

    // Step 1: Verify DBT manifest files
    await verifyDbtManifestFiles(inputs.dbt_target_path);

    // Step 2: Upload DBT artifacts to Recce Cloud
    await uploadDbtArtifacts(inputs);

    core.info('Action completed successfully!');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

// Run the action if this is the main module
if (require.main === module) {
  void run();
}
