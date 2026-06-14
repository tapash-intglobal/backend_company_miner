import swaggerJSDoc from 'swagger-jsdoc';
import config from './index';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Company Miner API',
    version: '1.0.0',
    description: 'API documentation for Company Miner backend',
  },
  servers: [
    {
      url: 'http://3.7.77.174:8131/api/v1',
      description: 'Staging server',
    },
    {
      url: `http://localhost:${config.port}/api/${config.apiVersion}`,
      description: 'Local server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      integrationApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Integration API key for Zoho webhooks (Bearer token also accepted)',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            nullable: true,
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'object', nullable: true },
        },
      },
      CompanyMinerResult: {
        type: 'object',
        properties: {
          aboutTheCompany: { type: 'string' },
          products: { type: 'array', items: { type: 'string' } },
          services: { type: 'array', items: { type: 'string' } },
          industry: { type: 'string' },
          top5SourcesOfIncome: { type: 'array', items: { type: 'string' } },
          financialResultsLatest5: { type: 'array', items: { type: 'string' } },
          currentChallenges: { type: 'array', items: { type: 'string' } },
          competitors: { type: 'array', items: { type: 'string' } },
          publicSearchUsed: { type: 'boolean' },
          yahooFinanceUsed: { type: 'boolean' },
          deepSearchUsed: { type: 'boolean' },
          deepSearchSourceCount: { type: 'integer' },
          suggestedServicesWeCanProvide: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                serviceId: { type: 'integer', nullable: true },
                serviceName: { type: 'string' },
                rationale: { type: 'string' },
              },
            },
          },
          pdfBase64: { type: 'string', nullable: true },
          pdfFilename: { type: 'string', nullable: true },
        },
      },
      GeneratedServiceEmail: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
          cta: { type: 'string' },
        },
      },
      MasterService: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          sortOrder: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ZohoMinerJobStatus: {
        type: 'object',
        properties: {
          job_id: { type: 'string', format: 'uuid' },
          lead_id: { type: 'string' },
          status: {
            type: 'string',
            enum: ['queued', 'processing', 'completed', 'failed'],
          },
          website: { type: 'string', nullable: true },
          resolved_website: { type: 'string', nullable: true },
          pdf_filename: { type: 'string', nullable: true },
          zoho_attachment_id: { type: 'string', nullable: true },
          error_message: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          started_at: { type: 'string', format: 'date-time', nullable: true },
          completed_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check (API + DB)',
        responses: {
          '200': {
            description: 'OK',
          },
          '503': {
            description: 'Degraded',
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User registered' },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login success' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Profile retrieved' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/admin/company-miner': {
      post: {
        tags: ['Company Miner'],
        summary: 'Mine company data from website URL',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: { type: 'string', example: 'https://example.com' },
                  instruction: { type: 'string', maxLength: 150 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Company mined successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/CompanyMinerResult' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/admin/company-miner/generate-service-email': {
      post: {
        tags: ['Company Miner'],
        summary: 'Generate outreach email from suggested services',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['companyUrl', 'minedResult', 'suggestedServices'],
                properties: {
                  companyUrl: { type: 'string' },
                  minedResult: { $ref: '#/components/schemas/CompanyMinerResult' },
                  suggestedServices: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceName', 'rationale'],
                      properties: {
                        serviceId: { type: 'integer' },
                        serviceName: { type: 'string' },
                        rationale: { type: 'string' },
                      },
                    },
                  },
                  instruction: { type: 'string', maxLength: 300 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Generated email',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/GeneratedServiceEmail' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/admin/master-services': {
      get: {
        tags: ['Master Services'],
        summary: 'List master services',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Master services retrieved' },
        },
      },
      post: {
        tags: ['Master Services'],
        summary: 'Create master service (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Master service created' },
        },
      },
    },
    '/admin/master-services/{id}': {
      get: {
        tags: ['Master Services'],
        summary: 'Get master service by id',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Master service retrieved' } },
      },
      put: {
        tags: ['Master Services'],
        summary: 'Update master service (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Master service updated' } },
      },
      delete: {
        tags: ['Master Services'],
        summary: 'Delete master service (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Master service deleted' } },
      },
    },
    '/integrations/zoho/leads/process': {
      post: {
        tags: ['Zoho Integration'],
        summary: 'Enqueue Company Miner job for a Zoho lead (async)',
        description:
          'Accepts lead_id and optional website. If website is omitted, the worker fetches it from Zoho CRM. Returns 202 immediately; mining and PDF attachment upload run in background.',
        security: [{ integrationApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['lead_id'],
                properties: {
                  lead_id: { type: 'string', example: '1234567890123456789' },
                  website: { type: 'string', example: 'https://acme.com' },
                  company: { type: 'string' },
                  email: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Job accepted',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/ZohoMinerJobStatus' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '401': { description: 'Invalid integration API key' },
        },
      },
    },
    '/integrations/zoho/jobs/{jobId}': {
      get: {
        tags: ['Zoho Integration'],
        summary: 'Get Zoho miner job status',
        security: [{ integrationApiKey: [] }],
        parameters: [
          { name: 'jobId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Job status',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/ZohoMinerJobStatus' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { description: 'Job not found' },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [],
};

export const swaggerSpec = swaggerJSDoc(options);
