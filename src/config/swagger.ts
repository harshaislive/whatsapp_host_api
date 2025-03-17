export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'WhatsApp API',
    version: '1.0.0',
    description: 'A REST API for WhatsApp messaging using Baileys library',
    contact: {
      name: 'API Support'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server'
    }
  ],
  tags: [
    {
      name: 'Messages',
      description: 'Message operations'
    },
    {
      name: 'System',
      description: 'System operations'
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Get server health status',
        description: 'Returns the health status of the server and WhatsApp connection',
        responses: {
          '200': {
            description: 'Server health information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok'
                    },
                    whatsapp: {
                      type: 'string',
                      enum: ['connected', 'disconnected'],
                      example: 'connected'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/messages/send': {
      post: {
        tags: ['Messages'],
        summary: 'Send a text message',
        description: 'Send a text message to a WhatsApp number',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to', 'message'],
                properties: {
                  to: {
                    type: 'string',
                    description: 'Recipient\'s phone number with country code',
                    example: '1234567890@s.whatsapp.net'
                  },
                  message: {
                    type: 'string',
                    description: 'Message content',
                    example: 'Hello, World!'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Message sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'boolean',
                      example: true
                    },
                    message: {
                      type: 'string',
                      example: 'Message sent successfully'
                    },
                    data: {
                      type: 'object',
                      description: 'Message details from WhatsApp'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'boolean',
                      example: false
                    },
                    message: {
                      type: 'string',
                      example: 'Missing required fields: to, message'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'boolean',
                      example: false
                    },
                    message: {
                      type: 'string',
                      example: 'Failed to send message'
                    },
                    error: {
                      type: 'string',
                      example: 'WhatsApp client not initialized'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/messages/send-media': {
      post: {
        tags: ['Messages'],
        summary: 'Send a media message',
        description: 'Send a media message (image, video, or document) to a WhatsApp number',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to', 'mediaUrl', 'type'],
                properties: {
                  to: {
                    type: 'string',
                    description: 'Recipient\'s phone number with country code',
                    example: '1234567890@s.whatsapp.net'
                  },
                  mediaUrl: {
                    type: 'string',
                    description: 'URL of the media file',
                    example: 'https://example.com/image.jpg'
                  },
                  type: {
                    type: 'string',
                    enum: ['image', 'video', 'document'],
                    description: 'Type of media',
                    example: 'image'
                  },
                  caption: {
                    type: 'string',
                    description: 'Optional caption for the media',
                    example: 'Check out this image!'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Media sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'boolean',
                      example: true
                    },
                    message: {
                      type: 'string',
                      example: 'Media sent successfully'
                    },
                    data: {
                      type: 'object',
                      description: 'Message details from WhatsApp'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'boolean',
                      example: false
                    },
                    message: {
                      type: 'string',
                      example: 'Missing required fields: to, mediaUrl, type'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'boolean',
                      example: false
                    },
                    message: {
                      type: 'string',
                      example: 'Failed to send media'
                    },
                    error: {
                      type: 'string',
                      example: 'WhatsApp client not initialized'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}; 