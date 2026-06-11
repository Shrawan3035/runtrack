package com.runtrack.backend.dto;

public class ProfileUpdateRequest {
    private String name;
    private String fitnessGoal;
    private Double weeklyDistanceGoal;
    private String experienceLevel;

    public ProfileUpdateRequest() {}

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getFitnessGoal() {
        return fitnessGoal;
    }

    public void setFitnessGoal(String fitnessGoal) {
        this.fitnessGoal = fitnessGoal;
    }

    public Double getWeeklyDistanceGoal() {
        return weeklyDistanceGoal;
    }

    public void setWeeklyDistanceGoal(Double weeklyDistanceGoal) {
        this.weeklyDistanceGoal = weeklyDistanceGoal;
    }

    public String getExperienceLevel() {
        return experienceLevel;
    }

    public void setExperienceLevel(String experienceLevel) {
        this.experienceLevel = experienceLevel;
    }
}
