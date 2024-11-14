const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Verificar método
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método no permitido' });
    }

    try {
        console.log('Recibida solicitud:', req.body);
        const { repoUrl, token } = req.body;

        if (!repoUrl) {
            return res.status(400).json({ message: 'URL del repositorio es requerida' });
        }

        // Extraer owner y repo de la URL
        const urlParts = repoUrl.replace('https://github.com/', '').split('/');
        if (urlParts.length < 2) {
            return res.status(400).json({ message: 'URL de repositorio inválida' });
        }

        const owner = urlParts[0];
        const repo = urlParts[1];

        console.log(`Procesando repositorio: ${owner}/${repo}`);

        const octokit = new Octokit({
            auth: token || process.env.GITHUB_TOKEN
        });

        // Verificar que el repositorio existe
        try {
            await octokit.repos.get({
                owner,
                repo
            });
        } catch (error) {
            return res.status(404).json({ 
                message: 'Repositorio no encontrado o sin acceso' 
            });
        }

        // Procesar repositorio
        const content = await processRepository(octokit, owner, repo);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `codeforias_${owner}_${repo}_${timestamp}.txt`;

        return res.status(200).json({
            success: true,
            filename,
            content
        });

    } catch (error) {
        console.error('Error en el servidor:', error);
        return res.status(500).json({
            message: 'Error procesando el repositorio: ' + error.message
        });
    }
};

async function processRepository(octokit, owner, repo) {
    let content = `CodeForias - Exportación de Repositorio\n`;
    content += `Fecha: ${new Date().toISOString()}\n`;
    content += `Repositorio: ${owner}/${repo}\n\n`;

    async function processPath(path = '') {
        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path
            });

            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.type === 'dir') {
                        content += `\nDirectorio: ${item.path}\n`;
                        await processPath(item.path);
                    } else if (item.type === 'file') {
                        content += `\n${'='.repeat(80)}\n`;
                        content += `Archivo: ${item.path}\n`;
                        content += `${'='.repeat(80)}\n`;

                        const fileData = await octokit.repos.getContent({
                            owner,
                            repo,
                            path: item.path
                        });

                        const fileContent = Buffer.from(fileData.data.content, 'base64').toString();
                        content += fileContent + '\n';
                    }
                }
            }
        } catch (error) {
            content += `Error procesando ${path}: ${error.message}\n`;
        }
    }

    await processPath();
    return content;
}