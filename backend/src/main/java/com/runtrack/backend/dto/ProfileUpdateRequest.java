package com.runtrack.backend.dto;

public class ProfileUpdateRequest {
    private String name;
    private String fitnessGoal;
    private Double weeklyDistanceGoal;
    private String experienceLevel;
    private Double weight;
    private Double height;
    private Integer age;

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

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    public Double getHeight() {
        return height;
    }

    public void setHeight(Double height) {
        this.height = height;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }
}
