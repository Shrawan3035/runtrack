package com.runtrack.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "marathon_plans")
public class MarathonPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate targetDate;

    @Column(nullable = false)
    private String targetDistance; // e.g. "Full Marathon", "Half Marathon", "10k"

    @Column(columnDefinition = "TEXT")
    private String planJson; // Stored JSON of weekly workouts

    @Column(columnDefinition = "TEXT")
    private String completedRuns; // Comma-separated list of completed day keys

    public MarathonPlan() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getTargetDate() {
        return targetDate;
    }

    public void setTargetDate(LocalDate targetDate) {
        this.targetDate = targetDate;
    }

    public String getTargetDistance() {
        return targetDistance;
    }

    public void setTargetDistance(String targetDistance) {
        this.targetDistance = targetDistance;
    }

    public String getPlanJson() {
        return planJson;
    }

    public void setPlanJson(String planJson) {
        this.planJson = planJson;
    }

    public String getCompletedRuns() {
        return completedRuns;
    }

    public void setCompletedRuns(String completedRuns) {
        this.completedRuns = completedRuns;
    }
}
