import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

export async function generateProductImage(productName: string, description: string): Promise<string> {
  const prompt = `professional product photography of ${productName}, ${description}, clean white background, studio lighting, high quality, commercial photography`;
  
  const payload = {
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: prompt,
      negativeText: 'people, anatomy, hands, low quality, low resolution, low detail, blurry, distorted'
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      quality: 'standard',
      height: 512,
      width: 512,
      cfgScale: 7.0
    }
  };

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-canvas-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  const imageBase64 = result.images[0];
  
  const imagesDir = join(process.cwd(), 'public', 'images');
  mkdirSync(imagesDir, { recursive: true });
  
  const filename = `${Date.now()}-${productName.replace(/\s+/g, '-').toLowerCase()}.png`;
  const filepath = join(imagesDir, filename);
  
  writeFileSync(filepath, Buffer.from(imageBase64, 'base64'));
  
  return `/images/${filename}`;
}
