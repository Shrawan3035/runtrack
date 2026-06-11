package com.runtrack.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.runtrack.backend.model.Activity;
import com.runtrack.backend.model.MarathonPlan;
import com.runtrack.backend.model.User;
import com.runtrack.backend.repository.ActivityRepository;
import com.runtrack.backend.repository.MarathonPlanRepository;
import com.runtrack.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${groq.api.key:}")
    private String groqApiKey;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private MarathonPlanRepository marathonPlanRepository;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> request) {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        User user = userOpt.get();

        List<Activity> recentActivities = activityRepository.findByUserIdOrderByDateDesc(userId);
        if (recentActivities.size() > 5) {
            recentActivities = recentActivities.subList(0, 5);
        }

        // Build history / prompt
        List<Map<String, Object>> messages = (List<Map<String, Object>>) request.get("messages");
        if (messages == null || messages.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Messages list cannot be empty");
        }

        // Construct System Instruction context
        StringBuilder systemContext = new StringBuilder();
        systemContext.append("You are a professional running coach named 'RunTrack Coach'.\n");
        systemContext.append("User profile details:\n");
        systemContext.append("- Name: ").append(user.getName()).append("\n");
        systemContext.append("- Goal: ").append(user.getFitnessGoal()).append("\n");
        systemContext.append("- Level: ").append(user.getExperienceLevel()).append("\n");
        systemContext.append("- Weekly Goal: ").append(user.getWeeklyDistanceGoal()).append(" km\n\n");

        if (!recentActivities.isEmpty()) {
            systemContext.append("Recent completed runs:\n");
            for (Activity a : recentActivities) {
                systemContext.append("- ").append(a.getDate()).append(": ").append(a.getDistance()).append(" km (")
                        .append(a.getDuration()).append(", type: ").append(a.getType()).append(")\n");
            }
            systemContext.append("\n");
        }
        systemContext.append("Answer the user's running questions, offer coaching support, encourage them, and keep responses concise and structured. Use markdown formatting if helpful.\n");

        // Call Gemini
        String replyText = callGeminiAPI(systemContext.toString(), messages);
        if (replyText == null) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "AI service is currently offline. Check your Gemini API Key."));
        }

        return ResponseEntity.ok(Map.of("reply", replyText));
    }

    @PostMapping("/workout")
    public ResponseEntity<?> generateWorkoutSuggestion() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        User user = userOpt.get();

        List<Activity> recentActivities = activityRepository.findByUserIdOrderByDateDesc(userId);
        if (recentActivities.size() > 5) {
            recentActivities = recentActivities.subList(0, 5);
        }

        StringBuilder prompt = new StringBuilder();
        prompt.append("Generate a single, personalized run workout suggestion for a runner with the following profile:\n");
        prompt.append("- Name: ").append(user.getName()).append("\n");
        prompt.append("- Goal: ").append(user.getFitnessGoal()).append("\n");
        prompt.append("- Level: ").append(user.getExperienceLevel()).append("\n");
        prompt.append("- Weekly Goal: ").append(user.getWeeklyDistanceGoal()).append(" km\n\n");

        if (!recentActivities.isEmpty()) {
            prompt.append("Recent runs:\n");
            for (Activity a : recentActivities) {
                prompt.append("- ").append(a.getDate()).append(": ").append(a.getDistance()).append(" km, type: ").append(a.getType()).append(", effort: ").append(a.getEffort()).append("/10\n");
            }
            prompt.append("\n");
        }

        prompt.append("Provide the workout recommendation in valid JSON format. Return ONLY the JSON object, do not wrap it in markdown block characters (like ```json). Use the exact keys: 'title', 'description', 'targetDistance' (decimal value), 'targetDuration' (string like MM:SS or HH:MM:SS), 'difficulty' (string: Easy, Medium, Hard), and 'coachingTips' (string).\n");

        String replyText = callGeminiAPISinglePrompt(prompt.toString());
        if (replyText == null) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Could not generate workout suggestion");
        }

        try {
            String clean = extractJson(replyText);
            JsonNode jsonNode = objectMapper.readTree(clean);
            return ResponseEntity.ok(jsonNode);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("AI returned malformed JSON: " + replyText);
        }
    }

    @GetMapping("/marathon")
    public ResponseEntity<?> getMarathonPlan() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<MarathonPlan> plans = marathonPlanRepository.findByUserId(userId);
        if (plans.isEmpty()) {
            return ResponseEntity.ok(Map.of("hasPlan", false));
        }
        MarathonPlan plan = plans.get(0);
        try {
            JsonNode planJson = objectMapper.readTree(plan.getPlanJson());
            Map<String, Object> response = new HashMap<>();
            response.put("hasPlan", true);
            response.put("id", plan.getId());
            response.put("startDate", plan.getStartDate());
            response.put("targetDate", plan.getTargetDate());
            response.put("targetDistance", plan.getTargetDistance());
            response.put("plan", planJson);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to parse saved plan");
        }
    }

    @PostMapping("/marathon")
    @Transactional
    public ResponseEntity<?> generateMarathonPlan(@RequestBody Map<String, Object> request) {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        User user = userOpt.get();

        String startDateStr = (String) request.get("startDate");
        String targetDateStr = (String) request.get("targetDate");
        String distance = (String) request.get("targetDistance"); // e.g. "Full Marathon", "Half Marathon", "10k"
        Object runsPerWeekObj = request.get("runsPerWeek");
        
        int runsPerWeek = 4; // default
        if (runsPerWeekObj instanceof Number) {
            runsPerWeek = ((Number) runsPerWeekObj).intValue();
        } else if (runsPerWeekObj instanceof String) {
            try {
                runsPerWeek = Integer.parseInt((String) runsPerWeekObj);
            } catch (Exception e) {}
        }

        if (startDateStr == null || targetDateStr == null || distance == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing startDate, targetDate, or targetDistance");
        }

        LocalDate startDate = LocalDate.parse(startDateStr);
        LocalDate targetDate = LocalDate.parse(targetDateStr);
        long weeksBetween = ChronoUnit.WEEKS.between(startDate, targetDate);

        if (weeksBetween < 2) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Target date must be at least 2 weeks after start date");
        }
        if (weeksBetween > 24) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Marathon planner supports a maximum training length of 24 weeks");
        }

        StringBuilder prompt = new StringBuilder();
        prompt.append("Create a detailed, day-by-day training program for: ").append(user.getName()).append("\n");
        prompt.append("- Level: ").append(user.getExperienceLevel()).append("\n");
        prompt.append("- Goal Distance: ").append(distance).append("\n");
        prompt.append("- Training Duration: ").append(weeksBetween).append(" weeks\n");
        prompt.append("- Start Date: ").append(startDateStr).append("\n");
        prompt.append("- Target Race Date: ").append(targetDateStr).append("\n");
        prompt.append("- Running days per week: ").append(runsPerWeek).append(" days\n");
        prompt.append("- Rest days per week: ").append(7 - runsPerWeek).append(" days\n\n");
        prompt.append("The schedule array for each week MUST contain exactly 7 objects (one for each day from Monday to Sunday in order). ");
        prompt.append("Exactly ").append(runsPerWeek).append(" days should have run workouts (distance > 0), and the remaining ").append(7 - runsPerWeek).append(" days should be marked as Rest days (type: 'Rest', distance: 0.0, description: 'Rest day').\n\n");
        prompt.append("Generate a plan in JSON format. Return ONLY the JSON array (do not wrap in markdown ```json blocks). The structure must be an array of weeks:\n");
        prompt.append("[\n");
        prompt.append("  {\n");
        prompt.append("    \"week\": 1,\n");
        prompt.append("    \"weeklyDistance\": 24.5,\n");
        prompt.append("    \"schedule\": [\n");
        prompt.append("      {\n");
        prompt.append("        \"day\": \"Monday\",\n");
        prompt.append("        \"type\": \"Rest\",\n");
        prompt.append("        \"distance\": 0.0,\n");
        prompt.append("        \"description\": \"Rest day\",\n");
        prompt.append("        \"targetDuration\": \"—\",\n");
        prompt.append("        \"coachingTips\": \"Focus on recovery, active stretching, and hydration. Let your body absorb the training.\",\n");
        prompt.append("        \"targetPace\": \"—\"\n");
        prompt.append("      },\n");
        prompt.append("      {\n");
        prompt.append("        \"day\": \"Tuesday\",\n");
        prompt.append("        \"type\": \"Easy\",\n");
        prompt.append("        \"distance\": 5.0,\n");
        prompt.append("        \"description\": \"Easy aerobic recovery run\",\n");
        prompt.append("        \"targetDuration\": \"35:00\",\n");
        prompt.append("        \"coachingTips\": \"Maintain a conversational pace. Focus on high cadence and light footfalls.\",\n");
        prompt.append("        \"targetPace\": \"6:30 - 7:00 /km\"\n");
        prompt.append("      },\n");
        prompt.append("      ...\n");
        prompt.append("    ]\n");
        prompt.append("  }\n");
        prompt.append("]\n");

        String replyText = callGeminiAPISinglePrompt(prompt.toString());
        if (replyText == null) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Could not contact Gemini AI service to build marathon plan");
        }

        try {
            String clean = extractJson(replyText);
            // Test parse it
            JsonNode parsedArray = objectMapper.readTree(clean);

            // Delete existing plans for this user first
            marathonPlanRepository.deleteByUserId(userId);

            MarathonPlan plan = new MarathonPlan();
            plan.setUserId(userId);
            plan.setStartDate(startDate);
            plan.setTargetDate(targetDate);
            plan.setTargetDistance(distance);
            plan.setPlanJson(clean);

            marathonPlanRepository.save(plan);

            return ResponseEntity.ok(Map.of(
                    "hasPlan", true,
                    "startDate", plan.getStartDate(),
                    "targetDate", plan.getTargetDate(),
                    "targetDistance", plan.getTargetDistance(),
                    "plan", parsedArray
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("AI returned invalid JSON: " + replyText);
        }
    }

    @DeleteMapping("/marathon")
    @Transactional
    public ResponseEntity<?> resetMarathonPlan() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        marathonPlanRepository.deleteByUserId(userId);
        return ResponseEntity.ok(Map.of("message", "Marathon plan reset successfully"));
    }

    private String getActiveGeminiKey() {
        return (geminiApiKey != null && !geminiApiKey.isEmpty()) ? geminiApiKey : System.getenv("GEMINI_API_KEY");
    }

    private String getActiveGroqKey() {
        return (groqApiKey != null && !groqApiKey.isEmpty()) ? groqApiKey : System.getenv("GROQ_API_KEY");
    }

    // Call Gemini API with conversational context
    private String callGeminiAPI(String systemInstruction, List<Map<String, Object>> frontendMessages) {
        String geminiKey = getActiveGeminiKey();
        String groqKey = getActiveGroqKey();

        boolean useGemini = geminiKey != null && geminiKey.startsWith("AIzaSy");
        boolean useGroq = groqKey != null && groqKey.startsWith("gsk_");

        if (!useGemini && useGroq) {
            return callGroqAPI(groqKey, systemInstruction, frontendMessages);
        }

        if (geminiKey == null || geminiKey.isEmpty() || !useGemini) {
            return "⚠️ Gemini API key (starting with AIzaSy) is not configured correctly, and no Groq fallback was found.";
        }

        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiKey;

        try {
            // Build the contents payload for Gemini
            ArrayNode contentsArray = objectMapper.createArrayNode();

            // Inject the system instruction as the first turn or in user prompt
            ObjectNode systemTurn = objectMapper.createObjectNode();
            systemTurn.put("role", "user");
            ArrayNode systemParts = systemTurn.putArray("parts");
            ObjectNode systemPartText = systemParts.addObject();
            systemPartText.put("text", "[System Instruction]: " + systemInstruction);
            contentsArray.add(systemTurn);

            // Inject model acknowledgment
            ObjectNode ackTurn = objectMapper.createObjectNode();
            ackTurn.put("role", "model");
            ArrayNode ackParts = ackTurn.putArray("parts");
            ObjectNode ackPartText = ackParts.addObject();
            ackPartText.put("text", "Understood. I will act as the user's running coach, utilizing their profile and training data.");
            contentsArray.add(ackTurn);

            // Loop and add conversation history
            for (Map<String, Object> msg : frontendMessages) {
                String role = (String) msg.get("role");
                String text = (String) msg.get("text");
                if (text == null || text.isEmpty()) continue;

                ObjectNode turn = objectMapper.createObjectNode();
                turn.put("role", "user".equalsIgnoreCase(role) ? "user" : "model");
                ArrayNode parts = turn.putArray("parts");
                ObjectNode partText = parts.addObject();
                partText.put("text", text);
                contentsArray.add(turn);
            }

            ObjectNode root = objectMapper.createObjectNode();
            root.set("contents", contentsArray);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(root.toString(), headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                return responseJson.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    // Call Gemini API with a single text prompt (used for workout / marathon JSON generation)
    private String callGeminiAPISinglePrompt(String prompt) {
        String geminiKey = getActiveGeminiKey();
        String groqKey = getActiveGroqKey();

        boolean useGemini = geminiKey != null && geminiKey.startsWith("AIzaSy");
        boolean useGroq = groqKey != null && groqKey.startsWith("gsk_");

        if (!useGemini && useGroq) {
            return callGroqAPISinglePrompt(groqKey, prompt);
        }

        if (geminiKey == null || geminiKey.isEmpty() || !useGemini) {
            return null;
        }

        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiKey;

        try {
            ObjectNode root = objectMapper.createObjectNode();
            ArrayNode contentsArray = root.putArray("contents");
            ObjectNode turn = contentsArray.addObject();
            turn.put("role", "user");
            ArrayNode parts = turn.putArray("parts");
            ObjectNode partText = parts.addObject();
            partText.put("text", prompt);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(root.toString(), headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                return responseJson.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    // Call Groq API with conversational context
    private String callGroqAPI(String groqKey, String systemInstruction, List<Map<String, Object>> frontendMessages) {
        String url = "https://api.groq.com/openai/v1/chat/completions";
        try {
            ArrayNode messagesArray = objectMapper.createArrayNode();
            
            // Add system instruction
            ObjectNode systemMsg = messagesArray.addObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", systemInstruction);
            
            // Add other messages
            for (Map<String, Object> msg : frontendMessages) {
                String role = (String) msg.get("role");
                String text = (String) msg.get("text");
                if (text == null || text.isEmpty()) continue;
                
                ObjectNode turn = messagesArray.addObject();
                turn.put("role", "user".equalsIgnoreCase(role) ? "user" : "assistant");
                turn.put("content", text);
            }
            
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", "llama-3.1-8b-instant");
            root.set("messages", messagesArray);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + groqKey);
            HttpEntity<String> entity = new HttpEntity<>(root.toString(), headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                return responseJson.path("choices").get(0).path("message").path("content").asText();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    // Call Groq API with a single text prompt
    private String callGroqAPISinglePrompt(String groqKey, String prompt) {
        String url = "https://api.groq.com/openai/v1/chat/completions";
        try {
            ArrayNode messagesArray = objectMapper.createArrayNode();
            ObjectNode turn = messagesArray.addObject();
            turn.put("role", "user");
            turn.put("content", prompt);
            
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", "llama-3.1-8b-instant");
            root.set("messages", messagesArray);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + groqKey);
            HttpEntity<String> entity = new HttpEntity<>(root.toString(), headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                return responseJson.path("choices").get(0).path("message").path("content").asText();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private String extractJson(String text) {
        if (text == null) return null;
        int firstArray = text.indexOf('[');
        int firstObject = text.indexOf('{');
        
        int start = -1;
        int end = -1;
        
        if (firstArray != -1 && (firstObject == -1 || firstArray < firstObject)) {
            start = firstArray;
            end = text.lastIndexOf(']');
        } else if (firstObject != -1) {
            start = firstObject;
            end = text.lastIndexOf('}');
        }
        
        if (start != -1 && end != -1 && end > start) {
            return text.substring(start, end + 1);
        }
        return text.trim();
    }
}
