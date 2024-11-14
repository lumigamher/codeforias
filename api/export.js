const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    // Habilitar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { repoUrl, token } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ message: 'URL del repositorio es requerida' });
        }

        // Extraer owner y repo de la URL
        const urlParts = repoUrl.replace('https://github.com/', '').split('/');
        const owner = urlParts[0];
        const repo = urlParts[1];

        const octokit = new Octokit({
            auth: token || process.env.GITHUB_TOKEN
        });

        // Obtener y procesar contenido
        const result = await exportRepository(octokit, owner, repo);

        // Generar nombre de archivo
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `codeforias_${owner}_${repo}_${timestamp}.txt`;

        // En producción, aquí subirías el archivo a un servicio de almacenamiento
        // Por ahora, enviamos el contenido directamente
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).json({
            success: true,
            filename,
            content: result,
            downloadUrl: `/api/download?filename=${filename}`
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error procesando el repositorio'
        });
    }
};

async function exportRepository(octokit, owner, repo) {
    let result = `CodeForias - Exportación de Repositorio\n`;
    result += `Fecha: ${new Date().toISOString()}\n`;
    result += `Repositorio: ${owner}/${repo}\n\n`;

    async function processContent(path = '') {
        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path
            });

            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.type === 'dir') {
                        result += `\nDirectorio: ${item.path}\n`;
                        await processContent(item.path);
                    } else if (item.type === 'file') {
                        result += `\n${'='.repeat(80)}\n`;
                        result += `Archivo: ${item.path}\n`;
                        result += `${'='.repeat(80)}\n`;
                        
                        const fileData = await octokit.repos.getContent({
                            owner,
                            repo,
                            path: item.path
                        });
                        
                        const content = Buffer.from(fileData.data.content, 'base64').toString();
                        result += content + '\n';
                    }
                }
            }
        } catch (error) {
            console.error(`Error procesando ${path}:`, error);
            result += `Error procesando ${path}: ${error.message}\n`;
        }
    }

    await processContent();
    return result;
}