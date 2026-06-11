package com.runtrack.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "activities")
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String type; // easy, tempo, interval, long, optional, custom

    private String customName;

    @Column(nullable = false)
    private Double distance; // in km

    @Column(nullable = false)
    private String duration; // "MM:SS" or "HH:MM:SS"

    private Double pace; // in min/km (stored for sorting and graphing)

    private Integer elevation; // in meters
    private Integer effort;    // 1 to 10

    @Column(length = 1000)
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String gpsRoute; // JSON string of coordinates: [{"lat":...,"lng":...,"time":...}, ...]

    public Activity() {}

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

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCustomName() {
        return customName;
    }

    public void setCustomName(String customName) {
        this.customName = customName;
    }

    public Double getDistance() {
        return distance;
    }

    public void setDistance(Double distance) {
        this.distance = distance;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public Double getPace() {
        return pace;
    }

    public void setPace(Double pace) {
        this.pace = pace;
    }

    public Integer getElevation() {
        return elevation;
    }

    public void setElevation(Integer elevation) {
        this.elevation = elevation;
    }

    public Integer getEffort() {
        return effort;
    }

    public void setEffort(Integer effort) {
        this.effort = effort;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getGpsRoute() {
        return gpsRoute;
    }

    public void setGpsRoute(String gpsRoute) {
        this.gpsRoute = gpsRoute;
    }
}
