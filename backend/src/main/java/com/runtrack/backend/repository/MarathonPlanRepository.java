package com.runtrack.backend.repository;

import com.runtrack.backend.model.MarathonPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MarathonPlanRepository extends JpaRepository<MarathonPlan, Long> {
    List<MarathonPlan> findByUserId(Long userId);
    void deleteByUserId(Long userId);
}
