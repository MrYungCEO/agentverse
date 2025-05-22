
// src/app/api/templates/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define the path to the templates.json file
// IMPORTANT: This path assumes your `data` directory is inside `src`
const templatesFilePath = path.join(process.cwd(), 'src', 'data', 'templates.json');

export async function GET() {
  try {
    const fileContents = await fs.readFile(templatesFilePath, 'utf8');
    const templates = JSON.parse(fileContents);
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error reading templates.json for GET request:", error);
    // If the file doesn't exist or is invalid, it's often better to return an empty array
    // or a clear error message rather than letting the client hang or crash.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File not found, which might be okay if it's the first run or it's been deleted.
      // Consider creating an empty file here or just returning an empty list.
      console.warn("templates.json not found. Returning empty array.");
      return NextResponse.json([]);
    }
    // For other errors (e.g., malformed JSON), return a server error.
    return NextResponse.json({ message: "Error reading templates data from server" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // --- CRITICAL SECURITY NOTE ---
  // In a real-world application, this endpoint MUST be protected.
  // Only authenticated administrators should be allowed to call this.
  // This could involve checking a session token, an API key in headers, etc.
  // For this example, protection is omitted for brevity but is ESSENTIAL.
  console.log("Received POST request to /api/templates");

  try {
    const newTemplates = await request.json();

    if (!Array.isArray(newTemplates)) {
      console.error("Invalid data format received. Expected an array of templates.");
      return NextResponse.json({ message: "Invalid data format: Array of templates expected." }, { status: 400 });
    }

    // Optional: Add more validation for the structure of each template in newTemplates here

    await fs.writeFile(templatesFilePath, JSON.stringify(newTemplates, null, 2), 'utf8');
    console.log("templates.json was updated successfully.");
    return NextResponse.json({ message: "Templates updated successfully on the server" });
  } catch (error) {
    console.error("Error writing to templates.json:", error);
    return NextResponse.json({ message: "Error updating templates data on the server" }, { status: 500 });
  }
}
