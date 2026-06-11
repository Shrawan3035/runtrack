package com.runtrack.backend.repository;

import com.runtrack.backend.model.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ActivityRepository extends JpaRepository<Activity, Long> {
    List<Activity> findByUserIdOrderByDateDesc(Long userId);
    List<Activity> findByUserIdAndDateBetween(Long userId, LocalDate startDate, LocalDate endDate);
    void deleteByUserId(Long userId);
}
