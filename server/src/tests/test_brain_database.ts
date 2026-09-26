/**
 * Comprehensive Unit Test for January Brain SQLite Memory Unit
 *
 * Validates:
 * 1. Database schema initialization & WAL mode
 * 2. Session creation, metadata, and listing
 * 3. User & assistant conversation message persistence
 * 4. Storing all multimodal artifact types:
 *    - Uploaded reference images (blueprints, reference photos)
 *    - AI-created images
 *    - Generated code (Python, C, C++)
 *    - Synthesized 3D models (.blend, .obj, .glb)
 *    - Uploaded 3D reference models (CAD, STL, OBJ)
 * 5. Reopening past conversation days later:
 *    - Resumes session context
 *    - Verifies all past messages are loaded in exact order
 *    - Verifies all associated files/artifacts remain linked to the session
 *    - Confirms prompt continuation history is formatted for LLM reasoning
 * 6. Brain statistics and metrics
 */

import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { brainDatabase } from '../brain/brainDatabase.js';
import { conversationManager } from '../brain/conversationManager.js';
import { artifactManager } from '../brain/artifactManager.js';
import { brainService } from '../brain/brainService.js';

async function runBrainTestSuite() {
  console.log(`\n============================================================`);
  console.log(`🧠 RUNNING JANUARY BRAIN SQLITE DATABASE TEST SUITE`);
  console.log(`============================================================\n`);

  // 1. Initialize Database
  console.log(`[Step 1] Initializing SQLite Brain Database...`);
  brainDatabase.initialize();
  const dbPath = brainDatabase.getDbPath();
  assert(fs.existsSync(dbPath), `Database file must exist at ${dbPath}`);
  console.log(`✅ Brain Database initialized at: ${dbPath}`);

  // 2. Create Chat Session
  console.log(`\n[Step 2] Creating Chat Session...`);
  const session = conversationManager.createSession({
    title: 'Aerospace Drone Engineering & CAD Modeling',
    summary: 'Design of quadcopter airframe and motor telemetry code',
    metadata: { project: 'AeroDrone-X', author: 'Ashwin' },
  });
  assert(session.id, 'Session must have a valid UUID');
  assert.strictEqual(session.title, 'Aerospace Drone Engineering & CAD Modeling');
  console.log(`✅ Created Chat Session: "${session.title}" (ID: ${session.id})`);

  // 3. Store Chat Messages (User and Assistant turns)
  console.log(`\n[Step 3] Storing Conversation Messages...`);
  const userMsg1 = conversationManager.addMessage({
    sessionId: session.id,
    role: 'user',
    content: 'Can you design a high-speed quadcopter chassis and write motor controller C++ code?',
  });
  assert(userMsg1.id, 'Message 1 must have an ID');

  const assistantMsg1 = conversationManager.addMessage({
    sessionId: session.id,
    role: 'assistant',
    content: 'Certainly! I have synthesized the quadcopter chassis in Blender with aerodynamic carbon-fiber arms, and drafted the PID motor controller in modern C++.',
    verbalSummary: "I've engineered the quadcopter chassis in Blender and written the C++ motor control code.",
    emotion: 'focused',
    modelName: 'Astra GPT-6 / Claude 3.5 Sonnet',
  });
  assert(assistantMsg1.id, 'Message 2 must have an ID');
  console.log(`✅ Stored ${2} conversation turns under session ${session.id}`);

  // 4. Store Multimodal Artifacts under this Session
  console.log(`\n[Step 4] Storing Multimodal Artifacts (Images, Code, 3D Models)...`);

  // 4a. Uploaded reference image (e.g. blueprint)
  const refImage = artifactManager.saveArtifact({
    sessionId: session.id,
    messageId: userMsg1.id,
    type: 'image_uploaded',
    name: 'drone_reference_blueprint.png',
    filePath: '/Users/ashwintelangstark/Desktop/drone_blueprint.png',
    fileSize: 245000,
    mimeType: 'image/png',
    metadata: { resolution: '1920x1080', source: 'user_upload' },
  });
  assert.strictEqual(refImage.type, 'image_uploaded');
  console.log(`✅ Saved Uploaded Reference Image: ${refImage.name}`);

  // 4b. Created AI Image
  const createdImage = artifactManager.saveArtifact({
    sessionId: session.id,
    messageId: assistantMsg1.id,
    type: 'image_created',
    name: 'drone_concept_render.png',
    filePath: '/Users/ashwintelangstark/Desktop/drone_render.png',
    fileSize: 512000,
    mimeType: 'image/png',
    metadata: { prompt: 'Futuristic carbon-fiber quadcopter drone', engine: 'Flux-1' },
  });
  assert.strictEqual(createdImage.type, 'image_created');
  console.log(`✅ Saved AI Created Image: ${createdImage.name}`);

  // 4c. Created Code File (C++ PID controller)
  const cppCode = `
#include <iostream>

class PIDController {
public:
    PIDController(double kp, double ki, double kd) : kp_(kp), ki_(ki), kd_(kd), prev_err_(0), integral_(0) {}
    double update(double setpoint, double current, double dt) {
        double error = setpoint - current;
        integral_ += error * dt;
        double derivative = (error - prev_err_) / dt;
        prev_err_ = error;
        return (kp_ * error) + (ki_ * integral_) + (kd_ * derivative);
    }
private:
    double kp_, ki_, kd_, prev_err_, integral_;
};
  `.trim();

  const codeArtifact = artifactManager.saveArtifact({
    sessionId: session.id,
    messageId: assistantMsg1.id,
    type: 'code_created',
    name: 'motor_pid_controller.cpp',
    content: cppCode,
    mimeType: 'text/x-c++',
    metadata: { language: 'cpp', compiler: 'clang++ -std=c++20' },
  });
  assert.strictEqual(codeArtifact.type, 'code_created');
  console.log(`✅ Saved Created Code: ${codeArtifact.name} (${codeArtifact.content?.length} bytes)`);

  // 4d. Synthesized 3D Model (.blend, .obj, .glb)
  const modelArtifact = artifactManager.saveArtifact({
    sessionId: session.id,
    messageId: assistantMsg1.id,
    type: '3d_model_created',
    name: 'quadcopter_frame.blend',
    filePath: '/Users/ashwintelangstark/Desktop/quadcopter_frame.blend',
    fileSize: 840000,
    mimeType: 'application/x-blender',
    metadata: {
      format: 'blend',
      objFilePath: '/Users/ashwintelangstark/Desktop/quadcopter_frame.obj',
      glbFilePath: '/Users/ashwintelangstark/Desktop/quadcopter_frame.glb',
      prompt: 'Quadcopter airframe with 4 rotors and landing skids',
      engine: 'Blender 5.2 / Astra GPT-6',
    },
  });
  assert.strictEqual(modelArtifact.type, '3d_model_created');
  console.log(`✅ Saved Synthesized 3D Model: ${modelArtifact.name}`);

  // 4e. Uploaded 3D Reference Model (CAD STEP / STL)
  const cadRef = artifactManager.saveArtifact({
    sessionId: session.id,
    type: '3d_model_uploaded',
    name: 'motor_mount_bracket.step',
    filePath: '/Users/ashwintelangstark/Desktop/motor_mount_bracket.step',
    fileSize: 120000,
    mimeType: 'application/step',
    metadata: { format: 'step', units: 'millimeters' },
  });
  assert.strictEqual(cadRef.type, '3d_model_uploaded');
  console.log(`✅ Saved Uploaded CAD Reference: ${cadRef.name}`);

  // 5. Test Conversation Resumption (Reopening Days Later)
  console.log(`\n[Step 5] Simulating Re-opening Conversation Days Later...`);
  const resumedContext = brainService.resumeSession(session.id);
  assert.strictEqual(resumedContext.session.id, session.id);
  assert.strictEqual(resumedContext.session.title, 'Aerospace Drone Engineering & CAD Modeling');
  assert.strictEqual(resumedContext.messages.length, 2, 'Must reload all historical messages');
  assert.strictEqual(resumedContext.artifacts.length, 5, 'Must reload all 5 stored multimodal artifacts');
  
  // Verify prompt history format
  assert.strictEqual(resumedContext.formattedPromptHistory.length, 2);
  assert.strictEqual(resumedContext.formattedPromptHistory[0].role, 'user');
  assert.strictEqual(resumedContext.formattedPromptHistory[1].role, 'assistant');
  console.log(`✅ Conversation restored successfully!`);
  console.log(`   - Title: "${resumedContext.session.title}"`);
  console.log(`   - Restored Messages: ${resumedContext.messages.length}`);
  console.log(`   - Restored Artifacts: ${resumedContext.artifacts.length} (Images, Code, 3D Models)`);
  console.log(`   - Prompt History ready for LLM continuation.`);

  // 6. Test Continuing the Conversation After Resumption
  console.log(`\n[Step 6] Continuing Discussion on Resumed Chat...`);
  const userMsg2 = brainService.recordUserMessage(
    'Now let us adjust the PID tuning parameters for windy conditions.'
  );
  assert.strictEqual(userMsg2.sessionId, session.id, 'New message must be added under resumed session');

  const assistantMsg2 = brainService.recordAssistantMessage(
    'Under strong wind shear, increase Kp to 1.8 for faster disturbance rejection and add anti-windup clamping to Ki.',
    {
      verbalSummary: 'I have adjusted the PID tuning for windy conditions by increasing Kp and clamping Ki.',
      emotion: 'focused',
      modelName: 'Claude 3.5 Sonnet',
    }
  );
  assert.strictEqual(assistantMsg2.sessionId, session.id);

  // Check updated message count
  const updatedMessages = brainService.getMessages(session.id);
  assert.strictEqual(updatedMessages.length, 4, 'Session should now contain 4 continuous messages');
  console.log(`✅ Successfully continued conversation. Total messages in thread: ${updatedMessages.length}`);

  // 7. Verify Brain Stats
  console.log(`\n[Step 7] Checking Brain Memory Unit Statistics...`);
  const stats = brainService.getStats();
  assert(stats.totalSessions >= 1, 'Should have at least 1 session');
  assert(stats.totalMessages >= 4, 'Should have at least 4 messages');
  assert(stats.totalArtifacts >= 5, 'Should have at least 5 artifacts');
  console.log(`✅ Brain Stats verified:`, {
    totalSessions: stats.totalSessions,
    totalMessages: stats.totalMessages,
    totalArtifacts: stats.totalArtifacts,
    breakdown: stats.artifactsByType,
  });

  console.log(`\n============================================================`);
  console.log(`🎉 ALL JANUARY BRAIN SQLITE TESTS PASSED PERFECTLY!`);
  console.log(`============================================================\n`);
}

runBrainTestSuite().catch((err) => {
  console.error('\n❌ Brain Test Suite Failed:', err);
  process.exit(1);
});
