jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

describe('aiService integration contract', () => {
  const loadService = ({ withToken = true } = {}) => {
    jest.resetModules();
    if (withToken) {
      process.env.AI_SERVICE_TOKEN = 'test-token';
    } else {
      delete process.env.AI_SERVICE_TOKEN;
    }
    process.env.AI_CIRCUIT_FAILURE_THRESHOLD = '2';
    process.env.AI_CIRCUIT_RESET_MS = '1000';

    const axios = require('axios');
    const service = require('../src/services/aiService');
    axios.get.mockReset();
    axios.post.mockReset();
    return { axios, service };
  };

  afterEach(() => {
    delete process.env.AI_SERVICE_TOKEN;
    delete process.env.AI_CIRCUIT_FAILURE_THRESHOLD;
    delete process.env.AI_CIRCUIT_RESET_MS;
  });

  it('sends text payload as { text } with auth header', async () => {
    const { axios, service } = loadService();

    axios.post.mockResolvedValueOnce({
      data: {
        incident_types: ['Medical'],
        severity: 'Red',
        confidence_scores: { Medical: 0.9 },
      },
    });

    await service.classifyText('Need ambulance now');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const call = axios.post.mock.calls[0];
    expect(call[1]).toEqual({ text: 'Need ambulance now' });
    expect(call[2].headers['x-ai-service-token']).toBe('test-token');
  });

  it('opens circuit after repeated failures', async () => {
    const { axios, service } = loadService();

    axios.get.mockRejectedValue(new Error('down'));

    await service.checkAiHealth();
    await service.checkAiHealth();

    await expect(service.classifyText('test')).rejects.toThrow('AI circuit is open');
  });

  it('omits auth header when AI_SERVICE_TOKEN is not set', async () => {
    const { axios, service } = loadService({ withToken: false });

    axios.post.mockResolvedValueOnce({
      data: {
        incident_types: ['Medical'],
        severity: 'Red',
        confidence_scores: { Medical: 0.9 },
      },
    });

    await service.classifyText('Need help quickly');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const call = axios.post.mock.calls[0];
    expect(call[2].headers['x-ai-service-token']).toBeUndefined();
  });
});
