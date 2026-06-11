package com.runtrack.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		loadDotEnv();
		SpringApplication.run(BackendApplication.class, args);
	}

	private static void loadDotEnv() {
		// Look for .env in current directory or parent directory
		Path envPath = Paths.get(".env");
		if (!Files.exists(envPath)) {
			envPath = Paths.get("../.env");
		}
		if (Files.exists(envPath)) {
			try {
				List<String> lines = Files.readAllLines(envPath);
				for (String line : lines) {
					line = line.trim();
					if (line.isEmpty() || line.startsWith("#")) {
						continue;
					}
					int equalIdx = line.indexOf('=');
					if (equalIdx > 0) {
						String key = line.substring(0, equalIdx).trim();
						String value = line.substring(equalIdx + 1).trim();
						if (value.startsWith("\"") && value.endsWith("\"")) {
							value = value.substring(1, value.length() - 1);
						} else if (value.startsWith("'") && value.endsWith("'")) {
							value = value.substring(1, value.length() - 1);
						}
						System.setProperty(key, value);
					}
				}
				System.out.println("✓ Loaded environment variables from " + envPath.toAbsolutePath());
			} catch (IOException e) {
				System.err.println("Failed to read .env file: " + e.getMessage());
			}
		}
	}
}
