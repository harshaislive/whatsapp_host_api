import { Router } from 'express';
import supabase from '../services/supabase.service';

const router = Router();

// Test database connection
router.get('/db', async (req, res) => {
    try {
        // Try to query the whatsapp_snippets table
        const { data, error } = await supabase
            .from('whatsapp_snippets')
            .select('id')
            .limit(1);

        if (error) {
            throw error;
        }

        res.json({
            status: 'success',
            message: 'Database connection successful',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Test storage connection
router.get('/storage', async (req, res) => {
    try {
        // Try to list files in the whatsapp-media bucket
        const { data, error } = await supabase
            .storage
            .from('whatsapp-media')
            .list();

        if (error) {
            throw error;
        }

        res.json({
            status: 'success',
            message: 'Storage connection successful',
            data: data
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Storage connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Test both connections
router.get('/all', async (req, res) => {
    try {
        // Test DB
        const dbResult = await supabase
            .from('whatsapp_snippets')
            .select('id')
            .limit(1);

        // Test Storage
        const storageResult = await supabase
            .storage
            .from('whatsapp-media')
            .list();

        if (dbResult.error) {
            throw new Error(`Database Error: ${dbResult.error.message}`);
        }

        if (storageResult.error) {
            throw new Error(`Storage Error: ${storageResult.error.message}`);
        }

        res.json({
            status: 'success',
            message: 'All connections successful',
            database: {
                status: 'connected',
                data: dbResult.data
            },
            storage: {
                status: 'connected',
                data: storageResult.data
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Connection test failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router; 