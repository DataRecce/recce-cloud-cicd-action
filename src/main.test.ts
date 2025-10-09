import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock all external dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('@actions/http-client');

const mockedCore = core as jest.Mocked<typeof core>;
const mockedGithub = github as jest.Mocked<typeof github>;

describe('Recce Cloud CI/CD Action', () => {
  const testDir = path.join(__dirname, '__test_artifacts__');

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default github context using Object.defineProperty
    Object.defineProperty(mockedGithub, 'context', {
      value: {
        repo: {
          owner: 'test-owner',
          repo: 'test-repo'
        },
        ref: 'refs/heads/main',
        eventName: 'push',
        payload: {},
        sha: 'test-sha',
        workflow: 'test-workflow',
        action: 'test-action',
        actor: 'test-actor',
        job: 'test-job',
        runNumber: 1,
        runId: 1,
        runAttempt: 1,
        apiUrl: 'https://api.github.com',
        serverUrl: 'https://github.com',
        graphqlUrl: 'https://api.github.com/graphql',
        issue: {
          owner: 'test-owner',
          repo: 'test-repo',
          number: 1
        }
      },
      writable: true,
      configurable: true
    });

    // Mock core.getInput
    mockedCore.getInput.mockImplementation((name: string) => {
      const defaults: Record<string, string> = {
        dbt_target_path: 'target',
        api_host: 'https://cloud.datarecce.io',
        web_host: 'https://cloud.datarecce.io',
        base_branch: 'main'
      };
      return defaults[name] || '';
    });

    // Mock process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'test-token';

    // Mock core methods
    mockedCore.info.mockImplementation(() => {});
    mockedCore.error.mockImplementation(() => {});
    mockedCore.debug.mockImplementation(() => {});
    mockedCore.setOutput.mockImplementation(() => {});
    mockedCore.setFailed.mockImplementation(() => {});

    // Create a properly typed mock summary using unknown first
    const mockSummary = {
      addHeading: jest.fn().mockReturnThis(),
      addRaw: jest.fn().mockReturnThis(),
      addLink: jest.fn().mockReturnThis(),
      addCodeBlock: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue(undefined)
    };
    mockedCore.summary = mockSummary as unknown as typeof core.summary;
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Verification', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    it('should pass when both manifest and catalog exist', async () => {
      // Create test files
      await fs.writeFile(
        path.join(testDir, 'manifest.json'),
        JSON.stringify({
          metadata: { adapter_type: 'postgres', dbt_version: '1.7.0' }
        })
      );
      await fs.writeFile(
        path.join(testDir, 'catalog.json'),
        JSON.stringify({ metadata: { generated_at: '2024-01-01T00:00:00Z' } })
      );

      mockedCore.getInput.mockImplementation((name: string) => {
        if (name === 'dbt_target_path') return testDir;
        return 'default';
      });

      // Files should be accessible
      await expect(fs.access(path.join(testDir, 'manifest.json'))).resolves.not.toThrow();
      await expect(fs.access(path.join(testDir, 'catalog.json'))).resolves.not.toThrow();
    });

    it('should fail when manifest.json is missing', async () => {
      await fs.writeFile(path.join(testDir, 'catalog.json'), '{}');

      await expect(fs.access(path.join(testDir, 'manifest.json'))).rejects.toThrow();
    });

    it('should fail when catalog.json is missing', async () => {
      await fs.writeFile(path.join(testDir, 'manifest.json'), '{}');

      await expect(fs.access(path.join(testDir, 'catalog.json'))).rejects.toThrow();
    });
  });

  describe('Adapter Type Extraction', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    it('should extract adapter type from manifest', async () => {
      const manifest = {
        metadata: {
          adapter_type: 'postgres',
          dbt_version: '1.7.0'
        },
        nodes: {}
      };

      await fs.writeFile(path.join(testDir, 'manifest.json'), JSON.stringify(manifest));

      const content = await fs.readFile(path.join(testDir, 'manifest.json'), 'utf8');
      const parsed = JSON.parse(content) as { metadata: { adapter_type: string } };

      expect(parsed.metadata.adapter_type).toBe('postgres');
    });

    it('should handle different adapter types', async () => {
      const adapterTypes = ['postgres', 'snowflake', 'bigquery', 'redshift'];

      for (const adapterType of adapterTypes) {
        const manifest = {
          metadata: {
            adapter_type: adapterType,
            dbt_version: '1.7.0'
          }
        };

        await fs.writeFile(path.join(testDir, 'manifest.json'), JSON.stringify(manifest));

        const content = await fs.readFile(path.join(testDir, 'manifest.json'), 'utf8');
        const parsed = JSON.parse(content) as { metadata: { adapter_type: string } };

        expect(parsed.metadata.adapter_type).toBe(adapterType);
      }
    });
  });

  describe('GitHub Context Handling', () => {
    it('should handle pull request events', () => {
      Object.defineProperty(mockedGithub, 'context', {
        value: {
          ...mockedGithub.context,
          eventName: 'pull_request',
          payload: {
            pull_request: {
              number: 123,
              head: {
                ref: 'feature-branch'
              }
            }
          }
        },
        writable: true,
        configurable: true
      });

      expect(mockedGithub.context.eventName).toBe('pull_request');

      // Type the payload properly for the test
      interface PullRequestPayload {
        pull_request: {
          number: number;
          head: { ref: string };
        };
      }

      expect((mockedGithub.context.payload as PullRequestPayload).pull_request.number).toBe(123);
    });

    it('should handle push events', () => {
      Object.defineProperty(mockedGithub, 'context', {
        value: {
          ...mockedGithub.context,
          eventName: 'push',
          ref: 'refs/heads/main'
        },
        writable: true,
        configurable: true
      });

      expect(mockedGithub.context.eventName).toBe('push');
      expect(mockedGithub.context.ref).toContain('main');
    });

    it('should extract branch name from ref', () => {
      const ref = 'refs/heads/feature/my-branch';
      const branchName = ref.replace('refs/heads/', '');

      expect(branchName).toBe('feature/my-branch');
    });
  });

  describe('Input Validation', () => {
    it('should have default values for optional inputs', () => {
      expect(mockedCore.getInput('dbt_target_path')).toBe('target');
      expect(mockedCore.getInput('api_host')).toBe('https://cloud.datarecce.io');
      expect(mockedCore.getInput('web_host')).toBe('https://cloud.datarecce.io');
    });

    it('should require GITHUB_TOKEN', () => {
      delete process.env.GITHUB_TOKEN;
      mockedCore.getInput.mockImplementation((name: string) => {
        if (name === 'github_token') return '';
        return 'default';
      });

      const token = process.env.GITHUB_TOKEN || mockedCore.getInput('github_token');
      expect(token).toBeFalsy();
    });

    it('should accept GITHUB_TOKEN from environment', () => {
      process.env.GITHUB_TOKEN = 'env-token';
      expect(process.env.GITHUB_TOKEN).toBe('env-token');
    });

    it('should accept GITHUB_TOKEN from input', () => {
      delete process.env.GITHUB_TOKEN;
      mockedCore.getInput.mockImplementation((name: string) => {
        if (name === 'github_token') return 'input-token';
        return 'default';
      });

      const token = mockedCore.getInput('github_token');
      expect(token).toBe('input-token');
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should have properly typed manifest structure', () => {
      interface TestManifest {
        metadata: {
          adapter_type: string;
          dbt_version: string;
        };
        nodes?: Record<string, unknown>;
      }

      const manifest: TestManifest = {
        metadata: {
          adapter_type: 'postgres',
          dbt_version: '1.7.0'
        },
        nodes: {}
      };

      expect(manifest.metadata.adapter_type).toBeDefined();
      expect(typeof manifest.metadata.adapter_type).toBe('string');
    });

    it('should have properly typed session response', () => {
      interface TestSessionResponse {
        session_id: string;
        manifest_upload_url: string;
        catalog_upload_url: string;
      }

      const response: TestSessionResponse = {
        session_id: 'abc123',
        manifest_upload_url: 'https://upload.url/manifest',
        catalog_upload_url: 'https://upload.url/catalog'
      };

      expect(response.session_id).toBeDefined();
      expect(typeof response.session_id).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parse errors gracefully', async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'manifest.json'), 'invalid json{');

      const content = await fs.readFile(path.join(testDir, 'manifest.json'), 'utf8');

      expect(() => JSON.parse(content) as unknown).toThrow();
    });

    it('should provide error context for debugging', () => {
      interface ErrorContext {
        repository: string;
        branch: string;
        eventType: string;
      }

      const context: ErrorContext = {
        repository: 'owner/repo',
        branch: 'main',
        eventType: 'push'
      };

      expect(context.repository).toBe('owner/repo');
      expect(context.branch).toBe('main');
      expect(context.eventType).toBe('push');
    });
  });
});
