// Configuration file for API keys and settings
const CONFIG = {
    OPENAI_API_KEY: 'key',
    MODEL_SETTINGS: {
        tensorflow: {
            name: 'TensorFlow.js',
            scripts: [
                'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js',
                'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3'
            ]
        },
        openai: {
            name: 'GPT-4 Vision',
            model: 'gpt-4o-mini',
            maxImageSize: 20 * 1024 * 1024
        }
    }
}; 