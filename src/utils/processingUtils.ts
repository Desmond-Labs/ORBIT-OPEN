export const calculateCost = (imageCount: number) => {
  let cost = 0;
  let remaining = imageCount;

  // First 49 images: $3.75 each
  if (remaining > 0) {
    const tier1 = Math.min(remaining, 49);
    cost += tier1 * 3.75;
    remaining -= tier1;
  }

  // Next 50 images (50-99): $3.25 each
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 50);
    cost += tier2 * 3.25;
    remaining -= tier2;
  }

  // Next 150 images (100-249): $2.75 each
  if (remaining > 0) {
    const tier3 = Math.min(remaining, 150);
    cost += tier3 * 2.75;
    remaining -= tier3;
  }

  // Remaining images (250+): $2.25 each
  if (remaining > 0) {
    cost += remaining * 2.25;
  }

  return Number(cost.toFixed(2));
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};