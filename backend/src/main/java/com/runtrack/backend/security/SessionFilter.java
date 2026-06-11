package com.runtrack.backend.security;

import com.runtrack.backend.model.UserSession;
import com.runtrack.backend.repository.UserSessionRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

@Component
public class SessionFilter extends OncePerRequestFilter {

    @Autowired
    private UserSessionRepository sessionRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            Optional<UserSession> sessionOpt = sessionRepository.findByToken(token);
            
            if (sessionOpt.isPresent()) {
                UserSession session = sessionOpt.get();
                if (session.getExpiryDate().isAfter(LocalDateTime.now())) {
                    // Valid session! Store user ID in context
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            session.getUserId(), // principal is the user ID
                            null,
                            Collections.emptyList()
                    );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else {
                    // Session expired, remove it
                    sessionRepository.delete(session);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
