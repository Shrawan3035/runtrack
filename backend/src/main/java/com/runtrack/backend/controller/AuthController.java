package com.runtrack.backend.controller;

import com.runtrack.backend.dto.AuthResponse;
import com.runtrack.backend.dto.LoginRequest;
import com.runtrack.backend.dto.ProfileUpdateRequest;
import com.runtrack.backend.dto.RegisterRequest;
import com.runtrack.backend.model.User;
import com.runtrack.backend.model.UserSession;
import com.runtrack.backend.repository.UserRepository;
import com.runtrack.backend.repository.UserSessionRepository;
import com.runtrack.backend.repository.ActivityRepository;
import com.runtrack.backend.repository.MarathonPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserSessionRepository sessionRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private MarathonPlanRepository marathonPlanRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Username is already taken");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        userRepository.save(user);

        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Optional<User> userOpt = userRepository.findByUsername(request.getUsername());
        if (userOpt.isEmpty() || !passwordEncoder.matches(request.getPassword(), userOpt.get().getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }

        User user = userOpt.get();

        // Generate session token
        String token = UUID.randomUUID().toString();
        // Clear previous sessions for user (clean)
        sessionRepository.deleteByUserId(user.getId());

        UserSession session = new UserSession(token, user.getId(), LocalDateTime.now().plusDays(7));
        sessionRepository.save(session);

        boolean onboarded = user.getFitnessGoal() != null && !user.getFitnessGoal().isEmpty();

        return ResponseEntity.ok(new AuthResponse(token, user.getUsername(), user.getName(), onboarded));
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        return ResponseEntity.ok(userOpt.get());
    }

    @PostMapping("/profile/update")
    public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateRequest request) {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        User user = userOpt.get();
        if (request.getName() != null) user.setName(request.getName());
        if (request.getFitnessGoal() != null) user.setFitnessGoal(request.getFitnessGoal());
        if (request.getWeeklyDistanceGoal() != null) user.setWeeklyDistanceGoal(request.getWeeklyDistanceGoal());
        if (request.getExperienceLevel() != null) user.setExperienceLevel(request.getExperienceLevel());
        if (request.getWeight() != null) user.setWeight(request.getWeight());
        if (request.getHeight() != null) user.setHeight(request.getHeight());
        if (request.getAge() != null) user.setAge(request.getAge());

        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<?> logout() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        sessionRepository.deleteByUserId(userId);
        return ResponseEntity.ok("Logged out successfully");
    }

    @DeleteMapping("/profile")
    @Transactional
    public ResponseEntity<?> deleteAccount() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        // Clean up dependent tables
        sessionRepository.deleteByUserId(userId);
        activityRepository.deleteByUserId(userId);
        marathonPlanRepository.deleteByUserId(userId);
        
        // Delete user record
        userRepository.deleteById(userId);

        return ResponseEntity.ok("Account and all related training data deleted successfully");
    }
}
