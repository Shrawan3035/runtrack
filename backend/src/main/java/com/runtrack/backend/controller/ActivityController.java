package com.runtrack.backend.controller;

import com.runtrack.backend.model.Activity;
import com.runtrack.backend.repository.ActivityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    @Autowired
    private ActivityRepository activityRepository;

    @GetMapping
    public ResponseEntity<?> getActivities() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<Activity> activities = activityRepository.findByUserIdOrderByDateDesc(userId);
        return ResponseEntity.ok(activities);
    }

    @PostMapping
    public ResponseEntity<?> logActivity(@RequestBody Activity activity) {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        activity.setUserId(userId);

        if (activity.getDate() == null) {
            activity.setDate(LocalDate.now());
        }

        // Calculate pace
        double calculatedPace = calculatePace(activity.getDistance(), activity.getDuration());
        activity.setPace(calculatedPace);

        Activity saved = activityRepository.save(activity);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteActivity(@PathVariable Long id) {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Optional<Activity> activityOpt = activityRepository.findById(id);
        if (activityOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Activity not found");
        }

        Activity activity = activityOpt.get();
        if (!activity.getUserId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied");
        }

        activityRepository.delete(activity);
        return ResponseEntity.ok("Activity deleted successfully");
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        Long userId = (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<Activity> activities = activityRepository.findByUserIdOrderByDateDesc(userId);

        double totalDistance = 0.0;
        double weeklyDistance = 0.0;
        double monthlyDistance = 0.0;
        
        LocalDate now = LocalDate.now();
        LocalDate startOfWeek = now.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate endOfWeek = now.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        LocalDate startOfMonth = now.with(TemporalAdjusters.firstDayOfMonth());
        LocalDate endOfMonth = now.with(TemporalAdjusters.lastDayOfMonth());

        double totalDurationMinutes = 0.0;
        double distanceForPace = 0.0;

        // Personal Bests: fastest pace for standard distances
        double pb5k = Double.MAX_VALUE;
        double pb10k = Double.MAX_VALUE;
        double pbHalfMarathon = Double.MAX_VALUE;

        for (Activity a : activities) {
            double dist = a.getDistance();
            totalDistance += dist;

            // Date checks
            LocalDate date = a.getDate();
            if (date != null) {
                if (!date.isBefore(startOfWeek) && !date.isAfter(endOfWeek)) {
                    weeklyDistance += dist;
                }
                if (!date.isBefore(startOfMonth) && !date.isAfter(endOfMonth)) {
                    monthlyDistance += dist;
                }
            }

            // Pace calculation aggregation
            double durationMins = getDurationInMinutes(a.getDuration());
            totalDurationMinutes += durationMins;
            distanceForPace += dist;

            // Simple PB extraction based on run distance brackets
            if (a.getPace() != null && a.getPace() > 0) {
                if (dist >= 21.09) {
                    if (a.getPace() < pbHalfMarathon) pbHalfMarathon = a.getPace();
                }
                if (dist >= 10.0) {
                    if (a.getPace() < pb10k) pb10k = a.getPace();
                }
                if (dist >= 5.0) {
                    if (a.getPace() < pb5k) pb5k = a.getPace();
                }
            }
        }

        double overallAvgPace = distanceForPace > 0 ? (totalDurationMinutes / distanceForPace) : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.putAll(Map.of(
            "totalDistance", totalDistance,
            "weeklyDistance", weeklyDistance,
            "monthlyDistance", monthlyDistance,
            "averagePace", overallAvgPace,
            "pb5k", pb5k == Double.MAX_VALUE ? 0.0 : pb5k,
            "pb10k", pb10k == Double.MAX_VALUE ? 0.0 : pb10k,
            "pbHalfMarathon", pbHalfMarathon == Double.MAX_VALUE ? 0.0 : pbHalfMarathon,
            "totalActivities", activities.size()
        ));

        return ResponseEntity.ok(stats);
    }

    private double calculatePace(Double distance, String duration) {
        if (distance == null || distance <= 0 || duration == null || duration.isEmpty()) {
            return 0.0;
        }
        double totalMinutes = getDurationInMinutes(duration);
        return totalMinutes / distance;
    }

    private double getDurationInMinutes(String duration) {
        if (duration == null || duration.isEmpty()) return 0.0;
        try {
            String[] parts = duration.split(":");
            if (parts.length == 2) {
                double mins = Double.parseDouble(parts[0]);
                double secs = Double.parseDouble(parts[1]);
                return mins + secs / 60.0;
            } else if (parts.length == 3) {
                double hrs = Double.parseDouble(parts[0]);
                double mins = Double.parseDouble(parts[1]);
                double secs = Double.parseDouble(parts[2]);
                return hrs * 60.0 + mins + secs / 60.0;
            } else {
                return Double.parseDouble(duration);
            }
        } catch (Exception e) {
            return 0.0;
        }
    }
}
