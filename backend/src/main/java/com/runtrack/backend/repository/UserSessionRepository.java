package com.runtrack.backend.repository;

import com.runtrack.backend.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, Long> {
    Optional<UserSession> findByToken(String token);
    void deleteByToken(String token);
    void deleteByUserId(Long userId);
}
